import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const distAssetsDir = join(process.cwd(), 'dist', 'assets')

function toKb(bytes) {
  return Number((bytes / 1024).toFixed(2))
}

function main() {
  const entries = readdirSync(distAssetsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => {
      const fullPath = join(distAssetsDir, entry.name)
      const size = statSync(fullPath).size
      return { file: entry.name, sizeBytes: size, sizeKb: toKb(size) }
    })

  const jsEntries = entries.filter((entry) => entry.file.endsWith('.js'))
  const cssEntries = entries.filter((entry) => entry.file.endsWith('.css'))

  const totalJsKb = toKb(jsEntries.reduce((sum, entry) => sum + entry.sizeBytes, 0))
  const totalCssKb = toKb(cssEntries.reduce((sum, entry) => sum + entry.sizeBytes, 0))
  const largestJs = jsEntries.sort((a, b) => b.sizeBytes - a.sizeBytes)[0]

  console.log('Performance Summary')
  console.log(`- JS total: ${totalJsKb} kB`)
  console.log(`- CSS total: ${totalCssKb} kB`)
  console.log(`- Largest JS chunk: ${largestJs.file} (${largestJs.sizeKb} kB)`)
  console.log('- Chunk list:')

  entries
    .sort((a, b) => b.sizeBytes - a.sizeBytes)
    .forEach((entry) => {
      console.log(`  - ${entry.file}: ${entry.sizeKb} kB`)
    })
}

main()
