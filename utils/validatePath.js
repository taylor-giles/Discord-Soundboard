const fs = require('fs');
const path = require('path');

/**
 * Validates that a group name is safe and resolves to a path within the sounds directory
 * Prevents directory traversal attacks
 * @param {string} groupName - The group name to validate
 * @param {string} soundsDirectory - The root sounds directory path
 * @returns {Object} { valid: boolean, path: string|null, error: string|null }
 */
function validateGroupPath(groupName, soundsDirectory) {
    try {
        // Reject group names with path separators
        if (groupName.includes(path.sep) || groupName.includes('/') || groupName.includes('\\')) {
            return { valid: false, path: null, error: 'Group name cannot contain path separators.' };
        }

        // Reject special directory names
        if (groupName === '.' || groupName === '..') {
            return { valid: false, path: null, error: 'Invalid group name.' };
        }

        // Resolve the full path
        const fullPath = path.resolve(path.join(soundsDirectory, groupName));
        const resolvedSoundsDir = path.resolve(soundsDirectory);

        // Verify the resolved path is within the sounds directory
        if (!fullPath.startsWith(resolvedSoundsDir + path.sep) && fullPath !== resolvedSoundsDir) {
            return { valid: false, path: null, error: 'Invalid group path.' };
        }

        return { valid: true, path: fullPath, error: null };
    } catch (error) {
        console.error("Error validating group path:", error);
        return { valid: false, path: null, error: 'Failed to validate group path.' };
    }
}

module.exports = { validateGroupPath };
