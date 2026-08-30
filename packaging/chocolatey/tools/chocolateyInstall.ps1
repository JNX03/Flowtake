$ErrorActionPreference = 'Stop'

$packageArgs = @{
  packageName    = $env:ChocolateyPackageName
  fileType       = 'msi'
  url64bit       = 'https://github.com/JNX03/Flowtake/releases/download/v1.6.0/Flowtake_1.6.0_x64_en-US.msi'
  checksum64     = '497fe1454687ee1224fc839c2290a44471041db7490e72f55ee14464add61b8d'
  checksumType64 = 'sha256'
  silentArgs     = '/qn /norestart'
  validExitCodes = @(0, 1641, 3010)
  softwareName   = 'Flowtake*'
}

Install-ChocolateyPackage @packageArgs
