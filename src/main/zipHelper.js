import { createWriteStream } from "node:fs"
import { rename } from "node:fs/promises"
import { join } from "node:path"
import { pipeline } from "node:stream/promises"
import path from 'path'
import { open } from "yauzl"
import { ZipFile } from "yazl"
import { projectJsonFileName } from "./paths"

// PRIVATE HELPER FUNCTIONS

/**
 * Creates a promisified wrapper for yazl operations
 * @param {ZipFile} zipFile - The yazl ZipFile instance
 * @param {Object} output - The output stream
 */
function createZipWriter(zipFile, output) {
    // Connect streams immediately
    zipFile.outputStream.pipe(output)

    return {
        addFile: (filePath, fileName) => zipFile.addFile(filePath, fileName),
        addReadStream: (stream, fileName) => zipFile.addReadStream(stream, fileName),
        finalize: () => new Promise((resolve, reject) => {
            zipFile.end()
            output.on('close', resolve)
            output.on('error', reject)
            zipFile.outputStream.on('error', reject)
        })
    }
}

/**
 * Creates a promisified wrapper for yauzl operations
 * @param {string|Buffer} source - File path or buffer
 * @param {Object} options - Options for yauzl
 */
function createZipReader(source, options = { lazyEntries: true }) {
    return new Promise((resolve, reject) => {

        open(source, options, (err, zipfile) => {
            if (err) {
                reject(err)
                return
            }

            const reader = {
                zipfile,
                forEach: onEntry => new Promise((resolveLoop, rejectLoop) => {
                    zipfile.readEntry()

                    zipfile.on("entry", async entry => {
                        try {
                            const result = await onEntry(entry, zipfile)
                            if (result === false) {
                                resolveLoop() // Stop iteration early
                                return
                            }
                            zipfile.readEntry()
                        } catch (entryErr) {
                            rejectLoop(entryErr)
                        }
                    })

                    zipfile.on("end", () => resolveLoop())
                    zipfile.on("error", rejectLoop)
                }),
                close: () => zipfile.close()
            }

            resolve(reader)
        })
    })
}

/**
 * Reads a string from a zip entry stream
 * @param {Object} entry - Zip entry
 * @param {Object} zipfile - Yauzl zipfile instance
 */
function readEntryAsString(entry, zipfile) {
    return new Promise((resolve, reject) => {
        zipfile.openReadStream(entry, (err, readStream) => {
            if (err) {
                reject(err)
                return
            }

            let data = ""
            readStream.on("data", chunk => {
                data += chunk.toString()
            })

            readStream.on("end", () => resolve(data))

            readStream.on("error", reject)
        })
    })
}

/**
 * Extracts specific files from an existing zip to a yazl ZipFile instance, with filtering options
 * @param {string} zipFilePath - Path to the existing zip file
 * @param {Object} writer - Zip writer instance
 * @param {Set} filesToSkip - Set of file names to skip
 */
async function extractFilteredFilesToZip(zipFilePath, writer, filesToSkip) {
    const reader = await createZipReader(zipFilePath)

    await reader.forEach(async (entry, zipfile) => {
        // Skip files that should be excluded
        if (filesToSkip.has(entry.fileName)) return

        return new Promise((resolve, reject) => {
            zipfile.openReadStream(entry, (err, readStream) => {
                if (err) {
                    reject(err)
                    return
                }

                writer.addReadStream(readStream, entry.fileName)
                resolve()
            })
        })
    })

    reader.close()
}

/**
 * Creates a temp zip file, processes it, and atomically replaces the original
 * @param {string} zipFilePath - Original zip file path
 * @param {Function} processZipFile - Function that processes the zip file (receives writer)
 */
async function createTempZipAndReplace(zipFilePath, processZipFile) {
    const tempZipFile = `${zipFilePath}.tmp`
    const zipFile = new ZipFile()
    const output = createWriteStream(tempZipFile)
    const writer = createZipWriter(zipFile, output)

    await processZipFile(writer)
    await writer.finalize()

    // Atomic replace
    await rename(tempZipFile, zipFilePath)
}

// PUBLIC API FUNCTIONS

/**
 * Creates a new zip file with the specified files
 * @param {string} zipFilePath - Path where the zip file should be created
 * @param {string[]} files - Array of file paths to add to the zip
 */
export async function createZip(zipFilePath, files) {
    const zipFile = new ZipFile()
    const output = createWriteStream(zipFilePath)
    const writer = createZipWriter(zipFile, output)

    // Add files using streaming
    for (const file of files) {
        const fileName = path.basename(file)
        writer.addFile(file, fileName)
    }

    await writer.finalize()
}

/**
 * Updates an existing zip file by merging with new files
 * @param {string} zipFilePath - Path to the existing zip file
 * @param {string[]} files - Array of file paths to add/update in the zip
 */
export async function updateZip(zipFilePath, files) {
    await createTempZipAndReplace(zipFilePath, async writer => {
        // Extract existing files first (excluding files that will be replaced)
        try {
            await extractExistingFilesToZip(zipFilePath, writer, files)
        } catch (error) {
            // If zip doesn't exist or is corrupted, treat as new
            console.warn('Could not read existing zip file, creating new one:', error.message)
        }

        // Add new files using streaming
        for (const file of files) {
            const fileName = path.basename(file)
            writer.addFile(file, fileName)
        }
    })
}

/**
 * Replaces a zip file with a new archive. Files from the old archive are discarded.
 * @param {string} zipFilePath - Path to the zip file to replace
 * @param {string[]} files - Array of file paths to add to the zip
 */
export async function replaceZip(zipFilePath, files) {
    await createTempZipAndReplace(zipFilePath, async writer => {
        // Add new files using streaming
        for (const file of files) {
            const fileName = path.basename(file)
            writer.addFile(file, fileName)
        }
    })
}

/**
 * Reads and parses the project.json file from a zip archive
 * @param {string} zipFilePath - Path to the zip file
 * @returns {Promise<Object|null>} Parsed JSON object or null if not found
 */
export async function readProjectJsonFromZip(zipFilePath) {
    let projectJsonData = null

    const reader = await createZipReader(zipFilePath)

    await reader.forEach(async (entry, zipfile) => {
        if (entry.fileName === projectJsonFileName) {
            const jsonData = await readEntryAsString(entry, zipfile)
            projectJsonData = JSON.parse(jsonData)
            return false // Stop iteration
        }
    })

    reader.close()
    return projectJsonData
}

/**
 * Extracts a zip file to a directory, using streaming for all files
 * @param {Buffer} path - Path to the zip file
 * @param {string} extractDir - Directory to extract files to
 * @returns {Promise<boolean>} True if extraction was successful and contains project.json
 */
export async function extractZip(path, extractDir) {
    let hasProjectJson = false

    const reader = await createZipReader(path)

    await reader.forEach(async (entry, zipfile) => {
        if (entry.fileName === projectJsonFileName) hasProjectJson = true

        return new Promise((resolve, reject) => {
            zipfile.openReadStream(entry, async (err, readStream) => {
                if (err) {
                    reject(err)
                    return
                }

                const writeStream = createWriteStream(join(extractDir, entry.fileName))
                await pipeline(readStream, writeStream)

                resolve()
            })
        })
    })

    reader.close()

    return hasProjectJson
}

/**
 * Checks if a zip file contains a valid project (has project.json)
 * @param {string} zipFilePath - Path to the zip file
 * @returns {Promise<boolean>} True if the zip contains project.json
 */
export async function isValidProjectZip(zipFilePath) {
    try {
        let hasProjectJson = false

        const reader = await createZipReader(zipFilePath)

        await reader.forEach(async entry => {
            if (entry.fileName === projectJsonFileName) {
                hasProjectJson = true
                return false // Stop iteration
            }
        })

        reader.close()
        return hasProjectJson
    } catch {
        return false
    }
}

/**
 * Helper function to extract existing files from a zip to a yazl ZipFile instance
 * @param {string} zipFilePath - Path to the existing zip file
 * @param {Object} writer - Zip writer instance
 * @param {string[]} filesToSkip - Files to skip (will be replaced)
 */
async function extractExistingFilesToZip(zipFilePath, writer, filesToSkip) {
    const skipFileNames = new Set(filesToSkip.map(file => path.basename(file)))
    await extractFilteredFilesToZip(zipFilePath, writer, skipFileNames)
}
