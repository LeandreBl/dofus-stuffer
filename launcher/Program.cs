using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Reflection;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Windows.Forms;

[assembly: AssemblyTitle("Dofus Stuffer")]
[assembly: AssemblyDescription("Lanceur de Dofus Stuffer avec Docker Compose")]
[assembly: AssemblyProduct("Dofus Stuffer")]
[assembly: AssemblyVersion("0.2.0.0")]
[assembly: AssemblyFileVersion("0.2.0.0")]

internal static class Program
{
    private static readonly string[] RequiredFiles = {
        "compose.yaml", "package.json", "package-lock.json", "data/catalog.json",
        "infra/api.Dockerfile", "infra/web.Dockerfile", "infra/nginx.conf", "infra/traefik/routes.yaml",
        "apps/api/package.json", "apps/api/src/main.ts", "apps/web/package.json", "apps/web/src/App.tsx",
        "packages/shared/package.json", "packages/shared/src/index.ts"
    };

    [STAThread]
    private static int Main(string[] args)
    {
        bool checkOnly = args.Length == 1 && string.Equals(args[0], "--check", StringComparison.OrdinalIgnoreCase);
        if (args.Length > 0 && !checkOnly) return 64;
        string directory = AppDomain.CurrentDomain.BaseDirectory;
        List<string> missing = new List<string>();
        try
        {
            foreach (string relative in RequiredFiles)
            {
                FileInfo file = new FileInfo(Path.Combine(directory, relative.Replace('/', Path.DirectorySeparatorChar)));
                if (!file.Exists || file.Length == 0) missing.Add(relative);
            }
            if (missing.Count > 0) throw new InvalidOperationException(
                "Des fichiers de l'application sont absents ou vides :\n\n" + string.Join("\n", missing.ToArray()) +
                "\n\nConservez le dossier complet avec DofusStuffer.exe.\n" + directory);
            ReadPort(directory);
        }
        catch (Exception error)
        {
            if (!checkOnly) MessageBox.Show(error.Message, "Dofus Stuffer", MessageBoxButtons.OK, MessageBoxIcon.Error);
            return 2;
        }
        if (checkOnly) return 0;
        bool created;
        using (Mutex mutex = new Mutex(true, "Local\\DofusStuffer.Startup", out created))
        {
            if (!created)
            {
                MessageBox.Show("Dofus Stuffer est déjà en cours de démarrage.", "Dofus Stuffer", MessageBoxButtons.OK, MessageBoxIcon.Information);
                return 0;
            }
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            using (LauncherWindow window = new LauncherWindow(directory, ReadPort(directory)))
            {
                Application.Run(window);
                mutex.ReleaseMutex();
                return window.ExitCode;
            }
        }
    }

    private static int ReadPort(string directory)
    {
        string value = Environment.GetEnvironmentVariable("APP_PORT");
        string envFile = Path.Combine(directory, ".env");
        if (string.IsNullOrWhiteSpace(value) && File.Exists(envFile))
        {
            foreach (string line in File.ReadAllLines(envFile))
            {
                string trimmed = line.Trim();
                if (trimmed.StartsWith("APP_PORT=", StringComparison.Ordinal))
                    value = trimmed.Substring("APP_PORT=".Length).Split('#')[0].Trim().Trim('"', '\'');
            }
        }
        if (string.IsNullOrWhiteSpace(value)) return 8080;
        int port;
        if (!int.TryParse(value, out port) || port < 1 || port > 65535)
            throw new InvalidOperationException("APP_PORT doit être un nombre compris entre 1 et 65535 dans le fichier .env.");
        return port;
    }
}

internal sealed class LauncherWindow : Form
{
    private readonly string directory;
    private readonly string url;
    private readonly string logPath;
    private readonly Label status;
    private readonly BackgroundWorker worker;
    private readonly object logLock = new object();
    internal int ExitCode { get; private set; }

    internal LauncherWindow(string appDirectory, int port)
    {
        directory = appDirectory;
        url = "http://localhost:" + port;
        logPath = Path.Combine(directory, ".local", "launcher.log");
        Text = "Dofus Stuffer";
        ClientSize = new Size(510, 208);
        StartPosition = FormStartPosition.CenterScreen;
        FormBorderStyle = FormBorderStyle.FixedDialog;
        MaximizeBox = false;
        MinimizeBox = true;
        ControlBox = false;
        BackColor = Color.FromArgb(17, 23, 26);
        ForeColor = Color.FromArgb(234, 240, 232);
        Font = new Font("Segoe UI", 10F);
        Label title = new Label { Text = "Votre atelier se prépare", Location = new Point(28, 23),
            Size = new Size(455, 33), Font = new Font("Segoe UI", 17F, FontStyle.Bold) };
        status = new Label { Text = "Vérification de Docker…", Location = new Point(30, 68), Size = new Size(450, 40) };
        ProgressBar progress = new ProgressBar { Location = new Point(31, 119), Size = new Size(447, 7),
            Style = ProgressBarStyle.Marquee, MarqueeAnimationSpeed = 30 };
        Label hint = new Label { Text = "Le premier démarrage télécharge les composants nécessaires.\nL'application s'ouvrira automatiquement dans votre navigateur.",
            Location = new Point(30, 146), Size = new Size(455, 44), ForeColor = Color.FromArgb(150, 165, 157), Font = new Font("Segoe UI", 9F) };
        Controls.AddRange(new Control[] { title, status, progress, hint });
        worker = new BackgroundWorker { WorkerReportsProgress = true };
        worker.DoWork += StartApplication;
        worker.ProgressChanged += delegate(object sender, ProgressChangedEventArgs args) { status.Text = (string)args.UserState; };
        worker.RunWorkerCompleted += delegate(object sender, RunWorkerCompletedEventArgs args)
        {
            if (args.Error != null)
            {
                ExitCode = 3;
                MessageBox.Show(this, args.Error.Message + "\n\nJournal détaillé :\n" + logPath,
                    "Dofus Stuffer", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
            else
            {
                try { Process.Start(new ProcessStartInfo { FileName = url, UseShellExecute = true, Verb = "open" }); }
                catch (Exception error)
                {
                    ExitCode = 3;
                    MessageBox.Show(this, "L'application est prête. Ouvrez " + url + " dans votre navigateur.\n\n" + error.Message, "Dofus Stuffer");
                }
            }
            Close();
        };
        Shown += delegate { worker.RunWorkerAsync(); };
    }

    private void StartApplication(object sender, DoWorkEventArgs args)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(logPath));
        File.WriteAllText(logPath, "Dofus Stuffer - " + DateTime.Now.ToString("u") + Environment.NewLine, Encoding.UTF8);
        try { RunDocker("--version", 15000); }
        catch (Exception error) { throw new InvalidOperationException("Docker est introuvable. Installez Docker Desktop, puis relancez DofusStuffer.exe.\n\n" + error.Message); }
        try { RunDocker("info --format \"{{.ServerVersion}}\"", 30000); }
        catch { throw new InvalidOperationException("Docker Desktop n'est pas prêt. Ouvrez Docker Desktop et attendez que son moteur soit démarré, puis relancez DofusStuffer.exe."); }
        try { RunDocker("compose version", 15000); }
        catch { throw new InvalidOperationException("Docker Compose est indisponible. Mettez Docker Desktop à jour, puis relancez l'application."); }
        worker.ReportProgress(0, "Construction et démarrage de l'application…");
        RunDocker("compose up --build -d", 20 * 60 * 1000);
        worker.ReportProgress(0, "Vérification du catalogue et du moteur de recherche…");
        DateTime deadline = DateTime.UtcNow.AddMinutes(2);
        while (DateTime.UtcNow < deadline)
        {
            if (IsHealthy()) return;
            Thread.Sleep(1500);
        }
        throw new InvalidOperationException("Les services ont démarré mais ne sont pas encore prêts. Consultez le journal, vérifiez Docker Desktop, puis réessayez.\n\nAdresse : " + url);
    }

    private void RunDocker(string arguments, int timeout)
    {
        Log("docker " + arguments);
        ProcessStartInfo start = new ProcessStartInfo {
            FileName = "docker.exe", Arguments = arguments, WorkingDirectory = directory,
            UseShellExecute = false, CreateNoWindow = true, WindowStyle = ProcessWindowStyle.Hidden,
            RedirectStandardOutput = true, RedirectStandardError = true,
            StandardOutputEncoding = Encoding.UTF8, StandardErrorEncoding = Encoding.UTF8
        };
        using (Process process = new Process { StartInfo = start })
        {
            process.OutputDataReceived += delegate(object sender, DataReceivedEventArgs args) { if (args.Data != null) Log(args.Data); };
            process.ErrorDataReceived += delegate(object sender, DataReceivedEventArgs args) { if (args.Data != null) Log(args.Data); };
            process.Start();
            process.BeginOutputReadLine();
            process.BeginErrorReadLine();
            if (!process.WaitForExit(timeout))
            {
                try { process.Kill(); } catch (InvalidOperationException) { }
                throw new InvalidOperationException("Le démarrage prend trop de temps. Vérifiez votre connexion et l'état de Docker Desktop.");
            }
            process.WaitForExit();
            if (process.ExitCode != 0) throw new InvalidOperationException("Docker n'a pas pu terminer le démarrage (code " + process.ExitCode + "). Consultez le journal pour connaître la cause.");
        }
    }

    private bool IsHealthy()
    {
        try
        {
            HttpWebRequest request = (HttpWebRequest)WebRequest.Create(url + "/api/health");
            request.Timeout = 3000;
            request.ReadWriteTimeout = 3000;
            request.Proxy = null;
            using (HttpWebResponse response = (HttpWebResponse)request.GetResponse())
            using (StreamReader reader = new StreamReader(response.GetResponseStream()))
            {
                string body = reader.ReadToEnd();
                Match workers = Regex.Match(body, "\"workers\"\\s*:\\s*(\\d+)");
                return response.StatusCode == HttpStatusCode.OK && Regex.IsMatch(body, "\"redis\"\\s*:\\s*true")
                    && workers.Success && int.Parse(workers.Groups[1].Value) > 0;
            }
        }
        catch (WebException) { return false; }
    }

    private void Log(string line)
    {
        lock (logLock) File.AppendAllText(logPath, line + Environment.NewLine, Encoding.UTF8);
    }
}
