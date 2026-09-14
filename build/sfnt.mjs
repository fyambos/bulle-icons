// Value the 32-bit words of a whole font file add up to.
export const FILE_CHECKSUM = 0xB1B0AFBA

// Vendor id of a font whose maker has no registered id.
export const NO_VENDOR = '    '

// Sum of the 32-bit words of a block, a short last word is completed with zeros.
export function checksum (bytes) {
  let sum = 0

  for (let i = 0; i < bytes.length; i += 4) {
    const word = (bytes[i] << 24) | ((bytes[i + 1] ?? 0) << 16) | ((bytes[i + 2] ?? 0) << 8) | (bytes[i + 3] ?? 0)
    sum = (sum + word) >>> 0
  }

  return sum
}

// The name table without the records of one name id.
export function withoutName (table, nameId) {
  const count = table.readUInt16BE(2)
  const storage = table.readUInt16BE(4)
  const kept = []

  for (let i = 0; i < count; i++) {
    const at = 6 + i * 12
    if (table.readUInt16BE(at + 6) === nameId) continue

    const start = storage + table.readUInt16BE(at + 10)
    kept.push({ ids: table.subarray(at, at + 8), text: table.subarray(start, start + table.readUInt16BE(at + 8)) })
  }

  const records = Buffer.alloc(6 + kept.length * 12)
  records.writeUInt16BE(table.readUInt16BE(0), 0)
  records.writeUInt16BE(kept.length, 2)
  records.writeUInt16BE(records.length, 4)

  let offset = 0

  kept.forEach(({ ids, text }, i) => {
    const at = 6 + i * 12
    ids.copy(records, at)
    records.writeUInt16BE(text.length, at + 8)
    records.writeUInt16BE(offset, at + 10)
    offset += text.length
  })

  return Buffer.concat([records, ...kept.map(({ text }) => text)])
}

// The OS/2 table with the line height of the hhea table, no line gap and no vendor.
export function plainMetrics (os2, hhea) {
  const table = Buffer.from(os2)

  table.write(NO_VENDOR, 58, 'latin1')
  table.writeInt16BE(hhea.readInt16BE(4), 68)
  table.writeInt16BE(hhea.readInt16BE(6), 70)
  table.writeInt16BE(0, 72)
  table.writeUInt16BE(hhea.readInt16BE(4), 74)
  table.writeUInt16BE(-hhea.readInt16BE(6), 76)

  return table
}

// Rebuilds a TrueType file with edited tables, offsets and checksums redone.
export function rebuild (ttf, edits) {
  const count = ttf.readUInt16BE(4)
  const source = new Map()

  for (let i = 0; i < count; i++) {
    const at = 12 + i * 16
    const start = ttf.readUInt32BE(at + 8)
    source.set(ttf.toString('latin1', at, at + 4), Buffer.from(ttf.subarray(start, start + ttf.readUInt32BE(at + 12))))
  }

  const tables = [...source].map(([tag, data]) => ({ tag, data: edits[tag] ? edits[tag](data, source) : data }))

  // The adjustment field of the head table counts as zero in every checksum.
  const headIndex = tables.findIndex((table) => table.tag === 'head')
  tables[headIndex].data.writeUInt32BE(0, 8)

  const directory = Buffer.alloc(12 + count * 16)
  ttf.copy(directory, 0, 0, 12)

  const bodies = []
  let offset = directory.length

  tables.forEach(({ tag, data }, i) => {
    const padded = Buffer.concat([data, Buffer.alloc((4 - (data.length % 4)) % 4)])
    const at = 12 + i * 16

    directory.write(tag, at, 'latin1')
    directory.writeUInt32BE(checksum(padded), at + 4)
    directory.writeUInt32BE(offset, at + 8)
    directory.writeUInt32BE(data.length, at + 12)

    bodies.push(padded)
    offset += padded.length
  })

  const font = Buffer.concat([directory, ...bodies])
  const head = font.readUInt32BE(12 + headIndex * 16 + 8)
  font.writeUInt32BE((FILE_CHECKSUM - checksum(font)) >>> 0, head + 8)

  return font
}
