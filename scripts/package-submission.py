"""Package source, report and sanitized evidence without local credentials."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import json

ROOT = Path(__file__).resolve().parents[1]
root_files = [
    'README.md', 'package.json', 'pnpm-lock.yaml', '.gitignore', '.gitattributes', '.env.example',
    'netlify.toml', 'Start-CineScope.cmd', 'Start-CineScope.ps1',
]
folders = ['server', 'public', 'scripts', 'tests', 'data', 'docs', 'cypher', 'reports', 'netlify/functions']
excluded = {'qa', '__pycache__', 'node_modules', '.local', '.netlify', '.git', 'tmp'}
files = [ROOT / name for name in root_files]
for folder in folders:
    files.extend(p for p in (ROOT / folder).rglob('*') if p.is_file() and not (set(p.relative_to(ROOT).parts) & excluded))
files.append(ROOT / 'output/pdf/CineScope_DA3_Project_Report.pdf')

# Inspect bytes in memory; never log connection values or package secret files.
secrets = []
cloud = ROOT / '.local/cloud-credentials.json'
if cloud.exists():
    secrets.append(json.loads(cloud.read_text())['NEO4J_PASSWORD'].encode())
desktop = ROOT / '.env'
if desktop.exists():
    for line in desktop.read_text().splitlines():
        if line.startswith('NEO4J_PASSWORD='):
            value = line.partition('=')[2].strip().strip('"').strip("'")
            if value:
                secrets.append(value.encode())

target = ROOT / 'output/CineScope_Project_Submission.zip'
target.parent.mkdir(parents=True, exist_ok=True)
with ZipFile(target, 'w', ZIP_DEFLATED) as archive:
    for path in sorted(set(files)):
        relative = path.relative_to(ROOT)
        if path.name.startswith('.env') and path.name != '.env.example':
            raise ValueError(f'Private configuration excluded: {relative}')
        content = path.read_bytes()
        if any(secret and secret in content for secret in secrets):
            raise ValueError(f'Credential found in submission file: {relative}')
        archive.writestr('CineScope/' + relative.as_posix(), content)
with ZipFile(target) as archive:
    assert archive.testzip() is None
    print(f'Submission packaged: {len(archive.namelist())} files; no private configuration or database passwords.')
