# =====================================================================
#  Publica o app Repertório (Conectados em Cristo) no Firebase.
#
#  Como usar: abra o PowerShell e cole
#      cd $HOME\Documents\projetos
#      .\publicar.ps1
# =====================================================================
$ErrorActionPreference = 'Continue'
$principal = 'claude/entrellun-video'           # branch principal do repositório
$desenvolvimento = 'claude/admiring-lovelace-ibx930'
$site = 'https://conectados-em-cristo-fe363.web.app'

function Passo($texto) { Write-Host "`n==> $texto" -ForegroundColor Cyan }
function Ok($texto) { Write-Host "    $texto" -ForegroundColor Green }
function Falhou($texto) {
  Write-Host "`nNAO DEU CERTO: $texto" -ForegroundColor Red
  Write-Host "Tire um print desta tela e mande para o Claude." -ForegroundColor Yellow
  Read-Host "`nAperte Enter para fechar"
  exit 1
}

Set-Location $PSScriptRoot

# 1. Programas necessários
Passo 'Conferindo os programas (Git e Node.js)'
foreach ($programa in 'git', 'node', 'npm') {
  if (-not (Get-Command $programa -ErrorAction SilentlyContinue)) {
    Falhou "nao encontrei o $programa. Instale o Git e o Node.js e abra o PowerShell de novo."
  }
}
Ok 'Tudo instalado.'

# 2. Versão mais recente do GitHub
Passo 'Baixando a versao mais recente do GitHub'
if (git status --porcelain) {
  Falhou 'tem arquivos alterados nesta pasta que nao foram salvos no GitHub.'
}
git fetch origin --quiet
if ($LASTEXITCODE -ne 0) { Falhou 'nao consegui falar com o GitHub. Confira a internet.' }
git cat-file -e "origin/${principal}:conectados-em-cristo/app/version.json" 2>$null
$branch = if ($LASTEXITCODE -eq 0) { $principal } else { $desenvolvimento }
git checkout $branch --quiet 2>$null
if ($LASTEXITCODE -ne 0) { git checkout -b $branch "origin/$branch" --quiet }
git pull --quiet origin $branch
if ($LASTEXITCODE -ne 0) { Falhou "nao consegui atualizar a branch $branch." }
$versao = (Get-Content 'conectados-em-cristo\app\version.json' -Raw -Encoding UTF8 | ConvertFrom-Json).versao
Ok "Branch $branch, versao $versao do app."

# 3. Ferramenta do Firebase
Passo 'Conferindo a ferramenta do Firebase'
if (-not (Get-Command firebase -ErrorAction SilentlyContinue)) {
  Write-Host '    Instalando (so na primeira vez, pode levar 1 ou 2 minutos)...'
  npm install -g firebase-tools
  if (-not (Get-Command firebase -ErrorAction SilentlyContinue)) { Falhou 'nao consegui instalar o firebase-tools.' }
}
Ok 'Pronta.'

Set-Location 'conectados-em-cristo\app'

# 4. Login no Google (só quando precisar)
Passo 'Conferindo o login no Firebase'
firebase projects:list *> $null
if ($LASTEXITCODE -ne 0) {
  Write-Host '    Vai abrir o navegador: entre com rhuan.4b@gmail.com e autorize.' -ForegroundColor Yellow
  firebase login
  firebase projects:list *> $null
  if ($LASTEXITCODE -ne 0) { Falhou 'o login no Firebase nao funcionou.' }
}
Ok 'Login feito.'

# 5. Preparação do projeto (só faz algo na primeira vez)
Passo 'Preparando o projeto no Firebase'
$primeiraVez = $false
$apps = (firebase apps:list WEB --json 2>$null | Out-String | ConvertFrom-Json -ErrorAction SilentlyContinue).result
if (-not $apps -or $apps.Count -eq 0) {
  firebase apps:create WEB Repertorio *> $null
  $primeiraVez = $true
  Ok 'App Web registrado.'
}
$saida = firebase firestore:databases:create '(default)' --location southamerica-east1 2>&1 | Out-String
if ($LASTEXITCODE -eq 0) { Ok 'Banco de dados criado (Sao Paulo).'; $primeiraVez = $true }
Ok 'Projeto pronto.'

# 6. Publicar
Passo 'Publicando o app'
firebase deploy --only 'hosting,firestore:rules'
if ($LASTEXITCODE -ne 0) { Falhou 'a publicacao falhou (veja as mensagens acima).' }

Write-Host "`n===============================================" -ForegroundColor Green
Write-Host "  PUBLICADO! Versao $versao no ar." -ForegroundColor Green
Write-Host "  $site" -ForegroundColor Green
Write-Host "===============================================" -ForegroundColor Green
if ($primeiraVez) {
  Write-Host "`nPRIMEIRA VEZ: falta ativar o login com Google (so uma vez):" -ForegroundColor Yellow
  Write-Host '  1. Vai abrir a pagina do Firebase. Clique em "Comecar" (se aparecer).'
  Write-Host '  2. Sign-in method -> Google -> Ativar -> escolha seu e-mail -> Salvar.'
  Start-Process 'https://console.firebase.google.com/project/conectados-em-cristo-fe363/authentication/providers'
  Read-Host "`nDepois de salvar, aperte Enter para abrir o app"
}
Start-Process $site
Set-Location $PSScriptRoot
