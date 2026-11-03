# Telefon surumu: oyunu tek oyun.html'de birlestirir, Android uygulamasi (APK) olarak paketler ve imzalar.
# Gerekenler: Android Studio'nun JDK'si ve Android SDK (build-tools, android-34+ platformu). Hicbir sey indirmez.
# Cikti: ..\Vegas Yolu.apk   Imza anahtari: android\vegasyolu.keystore (guncellemeler icin sakla).
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

# --- Araclari bul
$sdk = @($env:ANDROID_HOME, $env:ANDROID_SDK_ROOT, "$env:LOCALAPPDATA\Android\Sdk") | Where-Object { $_ -and (Test-Path "$_\build-tools") } | Select-Object -First 1
if (-not $sdk) { throw 'Android SDK bulunamadi (Android Studio ile kurulur).' }
$jdk = @($env:JAVA_HOME, "$env:ProgramFiles\Android\Android Studio\jbr") | Where-Object { $_ -and (Test-Path "$_\bin\javac.exe") } | Select-Object -First 1
if (-not $jdk) { throw 'JDK bulunamadi (Android Studio ile gelir).' }
$bt = Get-ChildItem "$sdk\build-tools" -Directory | Where-Object { Test-Path "$($_.FullName)\aapt2.exe" } |
  Sort-Object { [version]($_.Name -replace '[^0-9.]', '') } -Descending | Select-Object -First 1 -ExpandProperty FullName
$platform = @('android-34', 'android-35', 'android-36') | ForEach-Object { "$sdk\platforms\$_\android.jar" } | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $bt -or -not $platform) { throw 'build-tools ya da android-34+ platformu eksik.' }
$java = "$jdk\bin\java.exe"

# Yerel komutlari calistirir; uyarilar hata sayilmaz, yalnizca cikis kodu kontrol edilir.
function Run([string]$exe, [string[]]$a) {
  $prev = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
  $noise = '^(WARNING: (A restricted method|java\.lang\.System::load|Use --enable-native-access|Restricted methods)|System\.Management\.Automation\.RemoteException$)'
  try { & $exe @a 2>&1 | ForEach-Object { "$_" } | Where-Object { $_ -notmatch $noise } } finally { $ErrorActionPreference = $prev }
  if ($LASTEXITCODE -ne 0) { throw "Basarisiz ($LASTEXITCODE): $(Split-Path $exe -Leaf) $($a[0])" }
}

$out = "$PSScriptRoot\android\build"
if (Test-Path $out) { Remove-Item -Recurse -Force $out }
New-Item -ItemType Directory -Force "$out\assets", "$out\res", "$out\classes", "$out\dex" | Out-Null

# --- 1) Oyun: masaustu surumuyle ayni tek dosya
& "$PSScriptRoot\birlestir.ps1" -Hedef "$out\assets\oyun.html"

# --- 2) Kaynaklar ve ikonlar (ikon.png'den: eski cihazlar icin yuvarlak ikon, Android 8+ icin uyarlanabilir ikon)
Copy-Item -Recurse "$PSScriptRoot\android\res\*" "$out\res"
Add-Type -AssemblyName System.Drawing
$chip = [System.Drawing.Image]::FromFile("$PSScriptRoot\ikon.png")
function Save-Png([int]$size, [scriptblock]$draw, [string]$path) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'; $g.InterpolationMode = 'HighQualityBicubic'; $g.PixelOffsetMode = 'HighQuality'
  & $draw $g $size
  $g.Dispose(); $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png); $bmp.Dispose()
}
foreach ($d in @(@('mdpi', 1), @('hdpi', 1.5), @('xhdpi', 2), @('xxhdpi', 3), @('xxxhdpi', 4))) {
  $dir = "$out\res\mipmap-$($d[0])"
  New-Item -ItemType Directory -Force $dir | Out-Null
  Save-Png ([int](48 * $d[1])) { param($g, $s) $g.DrawImage($chip, 0, 0, $s, $s) } "$dir\ic_launcher.png"
  $a = [int](108 * $d[1])
  Save-Png $a {
    param($g, $s)
    $p = New-Object System.Drawing.Drawing2D.GraphicsPath
    $p.AddEllipse(-$s * .3, -$s * .3, $s * 1.6, $s * 1.6)
    $b = New-Object System.Drawing.Drawing2D.PathGradientBrush $p
    $b.CenterColor = [System.Drawing.Color]::FromArgb(255, 52, 112, 80)
    $b.SurroundColors = @([System.Drawing.Color]::FromArgb(255, 16, 40, 29))
    $g.FillRectangle($b, 0, 0, $s, $s); $b.Dispose(); $p.Dispose()
  } "$dir\ic_launcher_bg.png"
  Save-Png $a { param($g, $s) $c = $s * .6; $o = ($s - $c) / 2; $g.DrawImage($chip, [single]$o, [single]$o, [single]$c, [single]$c) } "$dir\ic_launcher_fg.png"
}
$chip.Dispose()

# --- 3) aapt2: kaynaklari derle; manifest, kaynaklar ve oyun dosyasini pakete koy
Run "$bt\aapt2.exe" @('compile', '--dir', "$out\res", '-o', "$out\res.zip")
Run "$bt\aapt2.exe" @('link', '-o', "$out\base.apk", '-I', $platform, '--manifest', "$PSScriptRoot\android\AndroidManifest.xml", '-A', "$out\assets", "$out\res.zip")

# --- 4) Java -> Android bayt kodu (dex)
$srcs = @(Get-ChildItem "$PSScriptRoot\android\src" -Recurse -Filter *.java | ForEach-Object { $_.FullName })
Run "$jdk\bin\javac.exe" (@('-encoding', 'UTF-8', '-source', '8', '-target', '8', '-Xlint:-options', '-bootclasspath', $platform, '-d', "$out\classes") + $srcs)
$classes = @(Get-ChildItem "$out\classes" -Recurse -Filter *.class | ForEach-Object { $_.FullName })
Run $java (@('-cp', "$bt\lib\d8.jar", 'com.android.tools.r8.D8', '--release', '--min-api', '24', '--lib', $platform, '--output', "$out\dex") + $classes)

# --- 5) dex'i ekle, hizala, imzala
Push-Location "$out\dex"
try { Run "$bt\aapt.exe" @('add', "$out\base.apk", 'classes.dex') } finally { Pop-Location }
Run "$bt\zipalign.exe" @('-p', '-f', '4', "$out\base.apk", "$out\aligned.apk")
$ks = "$PSScriptRoot\android\vegasyolu.keystore"
if (-not (Test-Path $ks)) {
  Run "$jdk\bin\keytool.exe" @('-genkeypair', '-keystore', $ks, '-storetype', 'PKCS12', '-alias', 'vegasyolu', '-keyalg', 'RSA', '-keysize', '2048', '-validity', '10000',
    '-storepass', 'vegasyolu', '-keypass', 'vegasyolu', '-dname', 'CN=Vegas Yolu, O=Vegas Yolu, C=TR')
}
$apk = [IO.Path]::GetFullPath("$PSScriptRoot\..\Vegas Yolu.apk")
Run $java @('-jar', "$bt\lib\apksigner.jar", 'sign', '--ks', $ks, '--ks-key-alias', 'vegasyolu', '--ks-pass', 'pass:vegasyolu', '--key-pass', 'pass:vegasyolu', '--v4-signing-enabled', 'false', '--out', $apk, "$out\aligned.apk")
if (Test-Path "$apk.idsig") { Remove-Item -Force "$apk.idsig" }
Run $java @('-jar', "$bt\lib\apksigner.jar", 'verify', $apk)
Remove-Item -Recurse -Force $out
Write-Host ("Tamam: Vegas Yolu.apk hazir ({0:N1} MB)." -f ((Get-Item $apk).Length / 1MB))
