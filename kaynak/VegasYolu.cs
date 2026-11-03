// Vegas Yolu başlatıcısı.
// Oyun (oyun.html) bu exe'nin içine gömülüdür. Exe onu %LOCALAPPDATA%\VegasYolu klasörüne çıkarır
// ve Edge'i (yoksa Chrome'u) adres çubuğu olmayan bir uygulama penceresi olarak açar.
// Kayıtlar (açılan masalar, istatistikler) aynı klasördeki "profil" içinde saklanır.
using System;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Windows.Forms;
using Microsoft.Win32;

[assembly: AssemblyTitle("Vegas Yolu")]
[assembly: AssemblyProduct("Vegas Yolu")]
[assembly: AssemblyDescription("Texas Hold'em poker: eğitim ve kariyer modu")]
[assembly: AssemblyVersion("1.0.0.0")]
[assembly: AssemblyFileVersion("1.0.0.0")]

static class Program
{
    [STAThread]
    static void Main(string[] args)
    {
        try
        {
            string baseDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "VegasYolu");
            Directory.CreateDirectory(baseDir);
            string html = Path.Combine(baseDir, "oyun.html");
            byte[] data = ReadResource("oyun.html");
            if (!File.Exists(html) || !Same(File.ReadAllBytes(html), data)) File.WriteAllBytes(html, data);

            string url = new Uri(html).AbsoluteUri;
            string profile = Path.Combine(baseDir, "profil");
            string browser = FindBrowser();

            if (args.Length > 0 && args[0] == "--kontrol")
            {
                File.WriteAllText(Path.Combine(baseDir, "kontrol.txt"),
                    "html=" + html + Environment.NewLine + "url=" + url + Environment.NewLine + "tarayici=" + (browser ?? "(bulunamadı)") + Environment.NewLine + "boyut=" + data.Length);
                return;
            }

            if (browser != null)
            {
                string a = "--app=\"" + url + "\" --user-data-dir=\"" + profile + "\"" +
                           " --no-first-run --no-default-browser-check --start-maximized" +
                           " --autoplay-policy=no-user-gesture-required --disable-features=Translate";
                ProcessStartInfo psi = new ProcessStartInfo(browser, a);
                psi.UseShellExecute = false;
                Process.Start(psi);
            }
            else
            {
                ProcessStartInfo psi = new ProcessStartInfo(html);
                psi.UseShellExecute = true;
                Process.Start(psi);
            }
        }
        catch (Exception ex)
        {
            MessageBox.Show("Oyun başlatılamadı:\n\n" + ex.Message, "Vegas Yolu", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }

    static byte[] ReadResource(string name)
    {
        using (Stream s = Assembly.GetExecutingAssembly().GetManifestResourceStream(name))
        using (MemoryStream m = new MemoryStream())
        {
            if (s == null) throw new Exception("Oyun dosyası exe içinde bulunamadı.");
            s.CopyTo(m);
            return m.ToArray();
        }
    }

    static bool Same(byte[] a, byte[] b)
    {
        if (a.Length != b.Length) return false;
        for (int i = 0; i < a.Length; i++) if (a[i] != b[i]) return false;
        return true;
    }

    static string FindBrowser()
    {
        string[] exes = { "msedge.exe", "chrome.exe" };
        RegistryKey[] roots = { Registry.CurrentUser, Registry.LocalMachine };
        foreach (string exe in exes)
        {
            foreach (RegistryKey root in roots)
            {
                using (RegistryKey k = root.OpenSubKey(@"SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\" + exe))
                {
                    if (k == null) continue;
                    string p = k.GetValue("") as string;
                    if (!string.IsNullOrEmpty(p))
                    {
                        p = p.Trim('"');
                        if (File.Exists(p)) return p;
                    }
                }
            }
        }
        string pf86 = Environment.GetEnvironmentVariable("ProgramFiles(x86)") ?? @"C:\Program Files (x86)";
        string pf = Environment.GetEnvironmentVariable("ProgramFiles") ?? @"C:\Program Files";
        string local = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        string[] candidates = {
            Path.Combine(pf86, @"Microsoft\Edge\Application\msedge.exe"),
            Path.Combine(pf, @"Microsoft\Edge\Application\msedge.exe"),
            Path.Combine(pf, @"Google\Chrome\Application\chrome.exe"),
            Path.Combine(pf86, @"Google\Chrome\Application\chrome.exe"),
            Path.Combine(local, @"Google\Chrome\Application\chrome.exe")
        };
        foreach (string c in candidates) if (File.Exists(c)) return c;
        return null;
    }
}
