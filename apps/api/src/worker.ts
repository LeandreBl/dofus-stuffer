import { BadRequestException, Logger } from '@nestjs/common';
import { WaitingError, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { loadCatalog } from './catalog.service.js';
import { cancellationKey, QUEUE_NAME, redisUrl } from './config.js';
import type { OptimizationJobData } from './jobs.service.js';
import { optimize, SearchConfigurationError } from './optimizer.js';
import { readSnapshot, writeSnapshot, type JobSnapshot } from './state.js';
import { validateRequest } from './validation.js';

export async function startWorker() {
  const logger = new Logger('OptimizationWorker');
  const connection = new Redis(redisUrl(), { maxRetriesPerRequest: null });
  const publisher = new Redis(redisUrl(), { maxRetriesPerRequest: 2 });
  for (const redis of [connection, publisher]) redis.on('error', () => logger.warn('Connexion Redis indisponible.'));
  let shuttingDown = false;
  const worker = new Worker<OptimizationJobData>(QUEUE_NAME, async (job, token) => {
    // Capture one immutable snapshot for the whole run; the next job can load a newer revision.
    const catalog = loadCatalog();
    const id = String(job.id);
    const now = new Date().toISOString();
    let snapshot: JobSnapshot = {
      id, status: 'running', createdAt: job.data.createdAt, updatedAt: now,
      progress: { percent: 0, evaluated: 0, feasible: 0, elapsedMs: 0, bestScore: null },
      results: [], catalogVersion: job.data.catalogVersion || catalog.version, catalogRevision: job.data.catalogRevision || catalog.revision,
      message: 'Exploration des combinaisons d’équipement.',
    };
    if ((job.data.catalogVersion && job.data.catalogVersion !== catalog.version)
      || (job.data.catalogRevision && job.data.catalogRevision !== catalog.revision)) {
      const message = 'Le catalogue a changé depuis la création de cette recherche. Actualisez la page et relancez-la.';
      await writeSnapshot(publisher, { ...snapshot, status: 'failed', error: message, message });
      throw new Error(message);
    }
    if (await publisher.exists(cancellationKey(id))) {
      await writeSnapshot(publisher, { ...snapshot, status: 'cancelled', message: 'Recherche annulée.' });
      return { status: 'cancelled' };
    }
    await writeSnapshot(publisher, snapshot);
    let interrupted = false;
    try {
      // Redis may retain jobs created before an API-contract update.
      const request = validateRequest(job.data.request, catalog);
      const result = await optimize(catalog, request, {
        onProgress: async update => {
          snapshot = { ...snapshot, ...update, updatedAt: new Date().toISOString(),
            message: update.results.length ? 'Amélioration des meilleurs stuffs trouvés.' : 'Recherche de combinaisons respectant les contraintes.' };
          await writeSnapshot(publisher, snapshot);
          const cancelled = Boolean(await publisher.exists(cancellationKey(id)));
          if (shuttingDown && !cancelled) interrupted = true;
          return shuttingDown || cancelled;
        },
      });
      if (interrupted) {
        // A deploy is not a user cancellation: hand the job back so another worker restarts it.
        await writeSnapshot(publisher, { ...snapshot, status: 'queued', updatedAt: new Date().toISOString(),
          message: 'Moteur redémarré : la recherche va reprendre automatiquement.' });
        await job.moveToWait(token);
        throw new WaitingError();
      }
      const completionReason = result.stopReason === 'candidates' ? ' Plafond de candidats atteint.'
        : result.stopReason === 'time' ? ' Durée choisie écoulée.' : '';
      snapshot = { ...snapshot, progress: result.progress, results: result.results,
        status: result.cancelled ? 'cancelled' : 'completed', updatedAt: new Date().toISOString(),
        message: result.cancelled ? 'Recherche arrêtée. Les résultats déjà trouvés restent disponibles.'
          : result.results.length ? `Recherche terminée : meilleurs stuffs trouvés, sans preuve d’optimalité.${completionReason}`
          : `Aucune combinaison conforme trouvée dans cette recherche. Cela ne prouve pas que vos contraintes sont impossibles.${completionReason}` };
      await writeSnapshot(publisher, snapshot);
      return { status: snapshot.status, evaluated: result.progress.evaluated };
    } catch (error) {
      if (error instanceof WaitingError) throw error;
      const safeError = error instanceof SearchConfigurationError ? error.message
        : error instanceof BadRequestException ? 'Les paramètres de cette recherche ne sont plus compatibles. Actualisez la page et relancez-la.'
        : 'Le moteur a rencontré une erreur. Vérifiez le catalogue et relancez la recherche.';
      await writeSnapshot(publisher, { ...snapshot, status: 'failed', updatedAt: new Date().toISOString(),
        error: safeError, message: safeError });
      throw new Error(safeError);
    }
  }, { connection, concurrency: 1, lockDuration: 30_000, maxStalledCount: 1 });

  worker.on('error', error => logger.error(error.message));
  worker.on('failed', async job => {
    if (!job?.id) return;
    try {
      const snapshot = await readSnapshot(publisher, job.id);
      if (snapshot && snapshot.status !== 'failed') await writeSnapshot(publisher, {
        ...snapshot, status: 'failed', updatedAt: new Date().toISOString(),
        error: 'Le moteur a interrompu cette recherche. Vous pouvez la relancer.',
      });
    } catch { logger.error('Impossible de sauvegarder l’échec d’une recherche.'); }
  });
  const close = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    await worker.close();
    await Promise.allSettled([connection.quit(), publisher.quit()]);
  };
  process.once('SIGTERM', () => { void close(); });
  process.once('SIGINT', () => { void close(); });
  const catalog = loadCatalog();
  logger.log(`Moteur prêt : catalogue ${catalog.version}, ${catalog.items.length} équipements.`);
}
