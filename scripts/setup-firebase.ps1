<#
  MOMENTUM - one-time Firebase setup for Pro billing, then deploy.

  Run from the repo root on a machine where you are logged in to Firebase:
      powershell -ExecutionPolicy Bypass -File scripts\setup-firebase.ps1

  What it does (asks before deploying):
    1. Checks the Firebase CLI login.
    2. Confirms the project is on the Blaze plan (needed for Cloud Functions).
    3. Reads the Firestore database location and writes FIRESTORE_REGION to
       functions\.env.<project> (the habit-limit trigger must run there).
    4. Creates the APPLE_IAP_PRIVATE_KEY secret with a placeholder if it does
       not exist yet (iOS purchases stay disabled until you set the real key).
    5. Installs and builds functions\, then deploys Firestore rules + functions.

  It does not create store products, enable live billing or buy anything.
  Works in Windows PowerShell 5.1 and PowerShell 7.
#>
param(
  [string]$ProjectId = 'streak-app-72026',
  [switch]$Yes
)

# 'Continue' on purpose: npm/npx write harmless warnings to stderr, which Windows PowerShell 5.1
# would otherwise treat as fatal. Every external command is checked by its exit code instead,
# and the script's own `throw`s still stop it on real failures.
$ErrorActionPreference = 'Continue'
Set-Location (Split-Path -Parent $PSScriptRoot)

function Step([string]$Message) { Write-Host "`n==> $Message" -ForegroundColor Cyan }
function Note([string]$Message) { Write-Host "    $Message" -ForegroundColor Gray }

# Runs the pinned Firebase CLI and captures its output (only for commands that never prompt).
# npm/npx print harmless warnings on stderr (e.g. "npm warn deprecated"); Windows PowerShell 5.1
# turns redirected stderr into errors, so errors are only judged by the exit code here.
function Invoke-Firebase {
  param([string[]]$Arguments, [switch]$AllowFail)
  $previous = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    $output = & npx --yes firebase-tools@15 @Arguments 2>&1
    $code = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previous
  }
  $lines = @($output | ForEach-Object {
    if ($_ -is [System.Management.Automation.ErrorRecord]) { $_.Exception.Message } else { "$_" }
  })
  if ($code -ne 0 -and -not $AllowFail) {
    $lines | ForEach-Object { Write-Host "    $_" }
    throw "firebase $($Arguments -join ' ') failed (exit $code)"
  }
  return [pscustomobject]@{ Code = $code; Lines = $lines }
}

function Confirm-Step([string]$Question) {
  if ($Yes) { return $true }
  $answer = Read-Host "$Question [y/N]"
  return $answer -match '^(y|yes)$'
}

# Firestore location -> Cloud Functions region for Firestore triggers.
function Get-TriggerRegion([string]$LocationId) {
  switch ($LocationId) {
    'nam5' { return 'us-central1' }
    'nam7' { return 'us-central1' }
    'eur3' { return 'europe-west1' }
    default { return $LocationId }
  }
}

# Sets KEY=VALUE in a dotenv file, keeping every other line.
function Set-DotEnvValue([string]$Path, [string]$Key, [string]$Value) {
  $lines = @()
  if (Test-Path $Path) { $lines = @(Get-Content $Path | Where-Object { $_ -notmatch "^$Key=" }) }
  $lines += "$Key=$Value"
  Set-Content -Path $Path -Value $lines -Encoding ascii
}

Step "Checking Firebase CLI login"
$login = Invoke-Firebase @('login:list') -AllowFail
if (-not ($login.Lines -match 'Logged in as')) {
  Note 'Not logged in. Opening the browser login...'
  & npx --yes firebase-tools@15 login
  if ($LASTEXITCODE -ne 0) { throw 'Firebase login failed.' }
} else {
  Note (($login.Lines -match 'Logged in as') | Select-Object -First 1)
}

Step "Blaze plan"
Note "Cloud Functions need the pay-as-you-go Blaze plan (usage of these functions normally stays in the free quota)."
Note "If you haven't yet: https://console.firebase.google.com/project/$ProjectId/usage/details -> Modify plan -> Blaze -> pick your billing account."
Note "Recommended: set a budget alert in Google Cloud Billing."
if (-not (Confirm-Step "Is $ProjectId on the Blaze plan now?")) { throw 'Upgrade to Blaze first, then run this script again.' }

Step "Firestore database location"
$db = Invoke-Firebase @('firestore:databases:get', '--project', $ProjectId, '--json')
$json = ($db.Lines -join "`n")
$start = $json.IndexOf('{')
if ($start -lt 0) { throw "Unexpected output from firestore:databases:get:`n$json" }
$parsed = $json.Substring($start) | ConvertFrom-Json
$location = $parsed.result.locationId
if (-not $location) { throw 'Could not read the Firestore location. Create the Firestore database in the Firebase console first.' }
$region = Get-TriggerRegion $location
$envFile = Join-Path 'functions' ".env.$ProjectId"
Set-DotEnvValue $envFile 'FIRESTORE_REGION' $region
Note "Firestore location: $location -> FIRESTORE_REGION=$region (saved to $envFile)"

Step "App Store key secret (APPLE_IAP_PRIVATE_KEY)"
$secret = Invoke-Firebase @('functions:secrets:get', 'APPLE_IAP_PRIVATE_KEY', '--project', $ProjectId) -AllowFail
if ($secret.Code -eq 0) {
  Note 'Secret already exists; leaving it unchanged.'
} else {
  Note 'Creating a placeholder so deploy works now; iOS purchases answer "not set up yet" until you set the real .p8 key.'
  $tmp = [System.IO.Path]::GetTempFileName()
  try {
    Set-Content -Path $tmp -Value 'not-configured' -NoNewline -Encoding ascii
    # May ask to enable the Secret Manager API: answer Yes.
    # Run directly (not captured) so any prompt is visible and answerable.
    & npx --yes firebase-tools@15 functions:secrets:set APPLE_IAP_PRIVATE_KEY --data-file $tmp --project $ProjectId
    if ($LASTEXITCODE -ne 0) { throw 'Creating the APPLE_IAP_PRIVATE_KEY secret failed.' }
  } finally {
    Remove-Item $tmp -ErrorAction SilentlyContinue
  }
}

Step "Installing and building functions"
& npm --prefix functions install
if ($LASTEXITCODE -ne 0) { throw 'npm install in functions failed.' }
& npm --prefix functions run build
if ($LASTEXITCODE -ne 0) { throw 'functions build failed.' }

Step "Deploy"
Note "Deploys Firestore security rules and 4 functions: verifyPurchase, playBillingNotifications, appStoreNotifications, enforceHabitLimit."
Note "Store products are not created and nothing is charged by this step."
if (-not (Confirm-Step "Deploy to $ProjectId now?")) { Write-Host 'Skipped deploy.'; exit 0 }

Note 'Answer the prompts Firebase shows (e.g. enabling APIs, image cleanup policy: accept the defaults).'
& npx --yes firebase-tools@15 deploy --only 'firestore:rules,functions' --project $ProjectId
if ($LASTEXITCODE -ne 0) {
  Note 'First deploys sometimes fail while Google sets up permissions for newly enabled APIs. Retrying in 90 seconds...'
  Start-Sleep -Seconds 90
  & npx --yes firebase-tools@15 deploy --only 'firestore:rules,functions' --project $ProjectId
  if ($LASTEXITCODE -ne 0) { throw 'Deploy failed twice. Copy the error above and share it.' }
}

Step "Done. Remaining manual steps (see docs/setup/billing.md)"
Note "1. Enable the Google Play Android Developer API:"
Note "   https://console.cloud.google.com/apis/library/androidpublisher.googleapis.com?project=$ProjectId"
Note "2. Play Console -> Users and permissions -> invite the functions service account"
Note "   (PROJECT_NUMBER-compute@developer.gserviceaccount.com; project number: Firebase console -> Project settings)"
Note "   with 'View financial data' and 'Manage orders and subscriptions'."
Note "3. Pub/Sub topic 'play-billing' was created by the deploy. Grant google-play-developer-notifications@system.gserviceaccount.com"
Note "   the Pub/Sub Publisher role on it: https://console.cloud.google.com/cloudpubsub/topic/detail/play-billing?project=$ProjectId"
Note "   then in Play Console -> Monetize -> Monetization setup set topic projects/$ProjectId/topics/play-billing and send a test notification."
Note "4. Create the products in Play Console (momentum_pro with base plans monthly/yearly, momentum_pro_lifetime) and add license testers."
