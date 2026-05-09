/**
 * Tauri Bridge - Compatibility layer that replaces window.electron.ipcRenderer
 * with Tauri's invoke/event system. This allows the existing renderer code to
 * work with minimal changes.
 */
import { invoke } from '@tauri-apps/api/core';
import { listen, emit, once } from '@tauri-apps/api/event';

// Map of Electron IPC channel names to Tauri command names
const COMMAND_MAP = {
    // Store
    'store-get': 'store_get',
    'store-set': 'store_set',
    'store-get-paginated': 'store_get_paginated',
    // Projects
    'get-projects': 'get_projects',
    'open-project': 'open_project',
    'close-project': 'close_project',
    'delete-project': 'delete_project',
    'save-json': 'save_json',
    'find-project': 'find_project',
    'open-project-dir': 'open_project_dir',
    'open-logs-dir': 'open_logs_dir',
    // Recording
    'init-recording': 'init_recording',
    'start-recording': 'start_recording',
    'pause-recording': 'pause_recording',
    'stop-recording': 'stop_recording',
    'reset-recording': 'reset_recording',
    'cancel-recording': 'cancel_recording',
    'get-camera-mic-config': 'get_camera_mic_config',
    'get-source-screenshot': 'get_source_screenshot',
    'take-recording-screenshot': 'take_recording_screenshot',
    'init-camera-file': 'init_camera_file',
    'enqueue-camera-chunk': 'enqueue_camera_chunk',
    'finalize-camera-file': 'finalize_camera_file',
    // Exporter
    'open-export-window': 'open_export_window',
    'close-export-window': 'close_export_window',
    'close-exporter-window': 'close_exporter_window',
    'get-project-for-export': 'get_project_for_export',
    'get-project-state': 'get_project_state',
    'get-open-section': 'get_open_section',
    'queue-render': 'queue_render',
    'process-audio': 'process_audio',
    'add-audio': 'add_audio',
    'set-progress-bar': 'set_progress_bar',
    'set-close-mode': 'set_close_mode',
    'set-has-rendering-or-completed-renders': 'set_has_rendering_or_completed_renders',
    'clean-up-temp-folder': 'clean_up_temp_folder',
    'copy-to-videos-folder': 'copy_to_videos_folder',
    'reveal-video-in-file-explorer': 'reveal_video_in_file_explorer',
    'play-video': 'play_video',
    'cancel-render': 'cancel_render',
    'send-notification': 'send_notification',
    'get-shareable-url': 'get_shareable_url',
    'upload': 'upload',
    'clear-pending-renders': 'clear_pending_renders',
    'cancel-running-render': 'cancel_running_render',
    'get-render-video-path': 'get_render_video_path',
    'open-url-in-browser': 'open_url_in_browser',
    // File operations
    'open': 'open_file',
    'read': 'read_file',
    'write': 'write_file',
    'close': 'close_file',
    'get-size': 'get_size',
    'get-video-path': 'get_video_path',
    // Windows
    'close-window': 'close_window',
    'destroy': 'destroy_window',
    'open-window-picker': 'open_window_picker',
    'close-window-picker-window': 'close_window_picker_window',
    'select-window': 'select_window',
    'get-windows': 'get_windows',
    'get-picker-screenshot': 'get_picker_screenshot',
    'open-area-picker': 'open_area_picker',
    'close-area-picker-window': 'close_area_picker_window',
    'select-area': 'select_area',
    'add-note': 'add_note',
    'toggle-drawing-overlay': 'toggle_drawing_overlay',
    'set-content-protection': 'set_content_protection',
    'get-window-at-point': 'get_window_at_point',
    'get-monitors': 'get_monitors',
    // App
    'get-version': 'get_version',
    'get-system-info': 'get_system_info',
    'get-machine-id': 'get_machine_id',
    'get-is-sentry-enabled': 'get_is_sentry_enabled',
    'check-permissions': 'check_permissions',
    'check-dependencies': 'check_dependencies',
    'install-dependencies': 'install_dependencies',
    'check-for-updates': 'check_for_updates',
    'install-update': 'install_update',
    'download-update': 'download_update',
    'launch-installer': 'launch_installer',
    'get-pending-installer': 'pending_installer_path',
    'get-changelog': 'get_changelog',
    'choose-export-directory': 'choose_export_directory',
    'get-autostart': 'get_autostart',
    'set-autostart': 'set_autostart',
    // Background
    'update-background': 'update_background',
    'get-wallpapers': 'get_wallpapers',
    'sync-background': 'sync_background',
    'get-background-images': 'get_background_images',
    'choose-background-image': 'choose_background_image',
    // Presets
    'save-preset': 'save_preset',
    'get-presets': 'get_presets',
    'delete-preset': 'delete_preset',
    'get-preset': 'get_preset',
    'open-preset-dir': 'open_preset_dir',
    'import-preset': 'import_preset',
    // Encoders/Capturers
    'get-encoders': 'get_encoders',
    'set-encoder': 'set_encoder',
    'get-capturers': 'get_capturers',
    'set-capturer': 'set_capturer',
    'extract-audio-buffer': 'extract_audio_buffer',
    // Audio
    'get-audio-sessions': 'get_audio_sessions',
    'mute-audio-sessions': 'mute_audio_sessions',
    'unmute-audio-sessions': 'unmute_audio_sessions',
    // Plugins
    'ensure-plugins-dir': 'ensure_plugins_dir',
    'list-plugins': 'list_plugins',
    'open-plugins-folder': 'open_plugins_folder',
    // Keyboard tracker
    'keyboard-start': 'keyboard_start',
    'keyboard-stop': 'keyboard_stop',
    'keyboard-get-events': 'keyboard_get_events',
    // Multi-app capture
    'start-multi-app-capture': 'start_multi_app_capture',
    'stop-multi-app-capture': 'stop_multi_app_capture',
    // Social Upload
    'youtube-set-credentials': 'youtube_set_credentials',
    'youtube-auth-start': 'youtube_auth_start',
    'youtube-auth-status': 'youtube_auth_status',
    'youtube-auth-disconnect': 'youtube_auth_disconnect',
    'youtube-upload-video': 'youtube_upload_video',
};

const arrayBufferToBase64 = (buffer) => {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
    let binary = ''
    const chunkSize = 0x8000
    for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + chunkSize, bytes.length)))
    }
    return btoa(binary)
}

// Map IPC arguments from positional to named for Tauri invoke
const ARGS_MAP = {
    'store_get': (args) => ({ key: args[0] }),
    'store_set': (args) => ({ key: args[0], value: args[1] }),
    'store_get_paginated': (args) => ({ key: args[0], requestedPage: args[1], itemsPerPage: args[2] }),
    'open_project': (args) => ({ id: args[0] }),
    'delete_project': (args) => ({ projectId: args[0] }),
    'save_json': (args) => ({ json: args[0] }),
    'open_project_dir': (args) => ({ projectId: args[0] }),
    'init_recording': (args) => ({ source: args[0], cameraMicConfig: args[1], systemAudio: args[2] }),
    'pause_recording': (args) => ({ pause: args[0] }),
    'cancel_recording': (args) => ({ error: args[0] }),
    'get_source_screenshot': (args) => ({ source: args[0] }),
    'enqueue_camera_chunk': (args) => ({ chunkBase64: arrayBufferToBase64(args[0]) }),
    'update_background': (args) => ({ type: args[0], relativePath: args[1] }),
    'sync_background': (args) => ({ background: args[0] }),
    'select_window': (args) => ({ window: args[0] }),
    'select_area': (args) => ({ selectedArea: args[0] }),
    'open_export_window': (args) => ({ stateData: args[0], section: args[1] }),
    'queue_render': (args) => ({ render: args[0] }),
    'process_audio': (args) => ({ renderId: args[0] }),
    'add_audio': (args) => ({ renderId: args[0] }),
    'set_progress_bar': (args) => ({ progress: args[0] }),
    'set_close_mode': (args) => ({ mode: args[0] }),
    'set_has_rendering_or_completed_renders': (args) => ({ hasRenders: args[0] }),
    'clean_up_temp_folder': (args) => ({ renderId: args[0] }),
    'copy_to_videos_folder': (args) => ({ renderId: args[0] }),
    'reveal_video_in_file_explorer': (args) => ({ renderId: args[0] }),
    'play_video': (args) => ({ renderId: args[0] }),
    'cancel_render': (args) => ({ renderId: args[0] }),
    'send_notification': (args) => ({ renderId: args[0] }),
    'get_shareable_url': (args) => ({ title: args[0] }),
    'upload': (args) => ({ renderId: args[0] }),
    'get_render_video_path': (args) => ({ renderId: args[0] }),
    'open_url_in_browser': (args) => ({ url: args[0] }),
    'keyboard_get_events': (args) => ({ startTimestamp: args[0] }),
    'start_multi_app_capture': (args) => ({ windows: args[0] }),
    'install_update': (args) => ({ downloadUrl: args[0] }),
    'download_update': (args) => ({ downloadUrl: args[0], version: args[1] }),
    'launch_installer': (args) => ({ installerPath: args[0] }),
    'set_autostart': (args) => ({ enabled: args[0] }),
    'open_file': (args) => ({ type: args[0], flag: args[1], args: args[2] }),
    'read_file': (args) => ({ fhId: args[0], start: args[1], end: args[2] }),
    'write_file': (args) => {
        // Base64-encode binary data for efficient IPC transfer (matches read_file pattern)
        const bytes = args[1] instanceof Uint8Array ? args[1] : new Uint8Array(args[1]);
        let binary = '';
        const chunkSize = 0x8000; // Process in 32KB chunks to avoid stack overflow
        for (let i = 0; i < bytes.length; i += chunkSize) {
            binary += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + chunkSize, bytes.length)));
        }
        return { fhId: args[0], data: btoa(binary), position: args[2] };
    },
    'close_file': (args) => ({ fhId: args[0] }),
    'get_size': (args) => ({ fhId: args[0] }),
    'get_video_path': (args) => ({ videoType: args[0], projectId: args[1] }),
    'save_preset': (args) => ({ preset: args[0] }),
    'get_presets': (args) => ({ page: args[0] }),
    'delete_preset': (args) => ({ id: args[0] }),
    'get_preset': (args) => ({ id: args[0] }),
    'open_preset_dir': (args) => ({ id: args[0] }),
    'get_encoders': (args) => ({ force: args[0] }),
    'set_encoder': (args) => ({ encoder: args[0] }),
    'get_capturers': (args) => ({ force: args[0] }),
    'set_capturer': (args) => ({ capturer: args[0] }),
    'set_content_protection': (args) => ({ enabled: args[0] }),
    'get_window_at_point': (args) => ({ x: args[0], y: args[1] }),
    'get_projects': (args) => ({ page: args[0] }),
    'extract_audio_buffer': (args) => ({ source: args[0] }),
    // Audio
    'mute_audio_sessions': (args) => ({ pids: args[0] }),
    // Social Upload
    'youtube_set_credentials': (args) => ({ clientId: args[0], clientSecret: args[1] }),
    'youtube_upload_video': (args) => ({ renderId: args[0], title: args[1], description: args[2], privacy: args[3] }),
};

// Store of event listeners for cleanup
const listeners = new Map();

/**
 * Create a compatibility layer that mimics window.electron.ipcRenderer
 */
const ipcRenderer = {
    async invoke(channel, ...args) {
        const tauriCommand = COMMAND_MAP[channel];
        if (!tauriCommand) {
            console.warn(`[TauriBridge] Unknown IPC channel: ${channel}`);
            return null;
        }

        const argsMapper = ARGS_MAP[tauriCommand];
        const namedArgs = argsMapper ? argsMapper(args) : {};

        try {
            return await invoke(tauriCommand, namedArgs);
        } catch (error) {
            console.error(`[TauriBridge] Error invoking ${tauriCommand}:`, error);
            throw error;
        }
    },

    on(channel, callback) {
        const unlisten = listen(channel, (event) => {
            // Mimic Electron's callback signature: (event, ...args)
            callback(event, event.payload);
        });

        if (!listeners.has(channel)) {
            listeners.set(channel, []);
        }
        listeners.get(channel).push({ callback, unlisten });

        return this;
    },

    once(channel, callback) {
        const wrappedCallback = (event) => {
            // Auto-remove from listeners map when it fires
            const channelListeners = listeners.get(channel);
            if (channelListeners) {
                const idx = channelListeners.findIndex(l => l.callback === callback);
                if (idx !== -1) channelListeners.splice(idx, 1);
            }
            callback(event, event.payload);
        };
        const unlisten = once(channel, wrappedCallback);

        if (!listeners.has(channel)) {
            listeners.set(channel, []);
        }
        listeners.get(channel).push({ callback, unlisten });

        return this;
    },

    send(channel, ...args) {
        emit(channel, args.length === 1 ? args[0] : args);
    },

    removeListener(channel, callback) {
        const channelListeners = listeners.get(channel);
        if (channelListeners) {
            const idx = channelListeners.findIndex(l => l.callback === callback);
            if (idx !== -1) {
                const { unlisten } = channelListeners[idx];
                // unlisten is a promise that resolves to an unlisten function
                unlisten.then(fn => fn());
                channelListeners.splice(idx, 1);
            }
        }
    },

    removeAllListeners(channel) {
        if (channel) {
            const channelListeners = listeners.get(channel);
            if (channelListeners) {
                channelListeners.forEach(({ unlisten }) => {
                    unlisten.then(fn => fn());
                });
                listeners.delete(channel);
            }
        } else {
            listeners.forEach((channelListeners) => {
                channelListeners.forEach(({ unlisten }) => {
                    unlisten.then(fn => fn());
                });
            });
            listeners.clear();
        }
    }
};

/**
 * Initialize the Tauri bridge by setting up window.electron compatibility
 */
export function initTauriBridge() {
    window.electron = {
        ipcRenderer,
        process: {
            platform: navigator.platform.includes('Win') ? 'win32' :
                navigator.platform.includes('Mac') ? 'darwin' : 'linux',
            versions: { electron: '0.0.0-tauri' }
        }
    };

    // Also expose as window.api for compatibility
    window.api = {};
}

export { ipcRenderer };
export default { initTauriBridge, ipcRenderer };
