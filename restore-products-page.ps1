# restore-products-page.ps1 (v2 — fixed newlines)
Set-Location "c:\projects\pos 43\stock-system"

Write-Host "Step 1: Restore from git commit 592a282..." -ForegroundColor Cyan

# git show returns array of lines — join with newline
$lines = git show "592a282:src/app/(dashboard)/products/page.tsx"
$content = $lines -join "`n"

Write-Host "Lines restored: $($lines.Count)" -ForegroundColor Green

Write-Host "Step 2: Add ImportRawModal render..." -ForegroundColor Cyan

$oldStyle = '            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>'
$newStyle = '            {showImportRaw && (
                <ImportRawModal
                    onClose={() => setShowImportRaw(false)}
                    onDone={() => { setShowImportRaw(false); fetchProducts() }}
                />
            )}

            ' + $oldStyle

$content = $content.Replace($oldStyle, $newStyle)

Write-Host "Step 3: Write file with UTF-8..." -ForegroundColor Cyan
[System.IO.File]::WriteAllText(
    "c:\projects\pos 43\stock-system\src\app\(dashboard)\products\page.tsx",
    $content,
    [System.Text.Encoding]::UTF8
)

# Verify
$result = Get-Content "c:\projects\pos 43\stock-system\src\app\(dashboard)\products\page.tsx"
Write-Host "Done! Total lines: $($result.Count)" -ForegroundColor Green

if ($content -match "ImportRawModal") {
    Write-Host "ImportRawModal render: FOUND" -ForegroundColor Green
}
else {
    Write-Host "ImportRawModal render: NOT FOUND (check manually)" -ForegroundColor Red
}
