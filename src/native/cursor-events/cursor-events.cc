#define WIN32_LEAN_AND_MEAN 1
#define OEMRESOURCE
#include <napi.h>
#include <windows.h>
#include <string>
#include <iostream>
#include <atomic>

#define WIN32_LEAN_AND_MEAN 1
#define OEMRESOURCE
#include <napi.h>
#include <windows.h>
#include <string>
#include <iostream>
#include <atomic>
#include <chrono>

// Global state - consider wrapping in a class for better encapsulation
namespace
{
    Napi::ThreadSafeFunction g_tsfn;
    HANDLE g_hThread = NULL;
    HANDLE g_hThreadExitEvent = NULL; // Event to signal thread completion
    std::atomic_bool g_captureMouseMove = false;
    std::atomic_bool g_installEventHook = false;
    std::atomic_bool g_shutdownRequested = false;
    DWORD g_dwThreadID = 0;
}

// mapping to CSS cursors - initialized on demand
HCURSOR defaultCursor = NULL;
HCURSOR textCursor = NULL;
HCURSOR waitCursor = NULL;
HCURSOR crosshairCursor = NULL;
HCURSOR verticalTextCursor = NULL;
HCURSOR nwseResizeCursor = NULL;
HCURSOR neswResizeCursor = NULL;
HCURSOR ewResizeCursor = NULL;
HCURSOR nsResizeCursor = NULL;
HCURSOR moveCursor = NULL;
HCURSOR notAllowedCursor = NULL;
HCURSOR pointerCursor = NULL;
HCURSOR progressCursor = NULL;

// Cursor handle management with error checking
bool InitializeCursorHandles()
{
    // Load standard cursors - these should never fail but let's be safe
    defaultCursor = (HCURSOR)LoadImage(nullptr, MAKEINTRESOURCE(OCR_NORMAL), IMAGE_CURSOR, 0, 0, LR_SHARED);
    textCursor = (HCURSOR)LoadImage(nullptr, MAKEINTRESOURCE(OCR_IBEAM), IMAGE_CURSOR, 0, 0, LR_SHARED);
    waitCursor = (HCURSOR)LoadImage(nullptr, MAKEINTRESOURCE(OCR_WAIT), IMAGE_CURSOR, 0, 0, LR_SHARED);
    crosshairCursor = (HCURSOR)LoadImage(nullptr, MAKEINTRESOURCE(OCR_CROSS), IMAGE_CURSOR, 0, 0, LR_SHARED);
    verticalTextCursor = (HCURSOR)LoadImage(nullptr, MAKEINTRESOURCE(OCR_UP), IMAGE_CURSOR, 0, 0, LR_SHARED);
    nwseResizeCursor = (HCURSOR)LoadImage(nullptr, MAKEINTRESOURCE(OCR_SIZENWSE), IMAGE_CURSOR, 0, 0, LR_SHARED);
    neswResizeCursor = (HCURSOR)LoadImage(nullptr, MAKEINTRESOURCE(OCR_SIZENESW), IMAGE_CURSOR, 0, 0, LR_SHARED);
    ewResizeCursor = (HCURSOR)LoadImage(nullptr, MAKEINTRESOURCE(OCR_SIZEWE), IMAGE_CURSOR, 0, 0, LR_SHARED);
    nsResizeCursor = (HCURSOR)LoadImage(nullptr, MAKEINTRESOURCE(OCR_SIZENS), IMAGE_CURSOR, 0, 0, LR_SHARED);
    moveCursor = (HCURSOR)LoadImage(nullptr, MAKEINTRESOURCE(OCR_SIZEALL), IMAGE_CURSOR, 0, 0, LR_SHARED);
    notAllowedCursor = (HCURSOR)LoadImage(nullptr, MAKEINTRESOURCE(OCR_NO), IMAGE_CURSOR, 0, 0, LR_SHARED);
    pointerCursor = (HCURSOR)LoadImage(nullptr, MAKEINTRESOURCE(OCR_HAND), IMAGE_CURSOR, 0, 0, LR_SHARED);
    progressCursor = (HCURSOR)LoadImage(nullptr, MAKEINTRESOURCE(OCR_APPSTARTING), IMAGE_CURSOR, 0, 0, LR_SHARED);

    // Verify at least the default cursor loaded
    return defaultCursor != NULL;
}

CURSORINFO curInfo = {};

struct MouseEventContext
{
public:
    int nCode;
    WPARAM wParam;
    LONG ptX;
    LONG ptY;
    DWORD mouseData;
    std::string cursor;
    long long timestamp;
};

void onMainThread(Napi::Env env, Napi::Function function, MouseEventContext *pMouseEvent)
{
    // Add null check for safety
    if (!pMouseEvent)
    {
        return;
    }

    auto nCode = pMouseEvent->nCode;
    auto wParam = pMouseEvent->wParam;
    auto ptX = pMouseEvent->ptX;
    auto ptY = pMouseEvent->ptY;
    auto nMouseData = pMouseEvent->mouseData;
    auto cursorName2 = pMouseEvent->cursor;
    auto timestamp = pMouseEvent->timestamp;

    // Delete early to ensure cleanup even if exceptions occur
    delete pMouseEvent;

    if (nCode >= 0)
    {
        auto name = "";
        auto button = -1;

        // Isolate mouse movement, as it's more CPU intensive
        if (wParam == WM_MOUSEMOVE)
        {
            // Is mouse movement
            if (g_captureMouseMove.load())
            {
                name = "mousemove";
            }
        }
        else
        {
            // Is not mouse movement

            // Determine event type
            if (wParam == WM_LBUTTONUP || wParam == WM_RBUTTONUP || wParam == WM_MBUTTONUP || wParam == WM_XBUTTONUP)
            {
                name = "mouseup";
            }
            else if (wParam == WM_LBUTTONDOWN || wParam == WM_RBUTTONDOWN || wParam == WM_MBUTTONDOWN || wParam == WM_XBUTTONDOWN)
            {
                name = "mousedown";
            }
            else if (wParam == WM_MOUSEWHEEL || wParam == WM_MOUSEHWHEEL)
            {
                name = "mousewheel";
            }

            // Determine button
            if (wParam == WM_LBUTTONUP || wParam == WM_LBUTTONDOWN)
            {
                button = 1;
            }
            else if (wParam == WM_RBUTTONUP || wParam == WM_RBUTTONDOWN)
            {
                button = 2;
            }
            else if (wParam == WM_MBUTTONUP || wParam == WM_MBUTTONDOWN)
            {
                button = 3;
            }
            else if (wParam == WM_MOUSEWHEEL)
            {
                button = 0;
            }
            else if (wParam == WM_MOUSEHWHEEL)
            {
                button = 1;
            }
        }

        // Only proceed if an event was identified and not shutting down
        if (name[0] != '\0' && !g_shutdownRequested.load())
        {
            Napi::HandleScope scope(env);

            auto x = Napi::Number::New(env, ptX);
            auto y = Napi::Number::New(env, ptY);
            auto cursor2 = Napi::String::New(env, cursorName2);
            auto timestamp2 = Napi::Number::New(env, timestamp);
            auto mouseData = Napi::Number::New(env, nMouseData);

            // Yell back to NodeJS
            function.Call(env.Global(),
                          {Napi::String::New(env, name), x, y, cursor2, timestamp2, Napi::Number::New(env, button), mouseData});
        }
    }
}

LRESULT CALLBACK HookCallback(int nCode, WPARAM wParam, LPARAM lParam)
{
    // Check if shutdown is requested to avoid processing during cleanup
    if (g_shutdownRequested.load())
    {
        return CallNextHookEx(NULL, nCode, wParam, lParam);
    }

    // Add null pointer checks for safety
    if (lParam == NULL)
    {
        return CallNextHookEx(NULL, nCode, wParam, lParam);
    }

    curInfo.cbSize = sizeof(curInfo);
    // Add error checking for GetCursorInfo
    if (!GetCursorInfo(&curInfo))
    {
        // If cursor info fails, use default and continue
        curInfo.hCursor = defaultCursor;
    }

    auto cursorName = "default";
    if (curInfo.hCursor == textCursor)
    {
        cursorName = "text";
    }
    else if (curInfo.hCursor == waitCursor)
    {
        cursorName = "wait";
    }
    else if (curInfo.hCursor == crosshairCursor)
    {
        cursorName = "crosshair";
    }
    else if (curInfo.hCursor == verticalTextCursor)
    {
        cursorName = "vertical-text";
    }
    else if (curInfo.hCursor == nwseResizeCursor)
    {
        cursorName = "nwse-resize";
    }
    else if (curInfo.hCursor == neswResizeCursor)
    {
        cursorName = "nesw-resize";
    }
    else if (curInfo.hCursor == ewResizeCursor)
    {
        cursorName = "ew-resize";
    }
    else if (curInfo.hCursor == nsResizeCursor)
    {
        cursorName = "ns-resize";
    }
    else if (curInfo.hCursor == moveCursor)
    {
        cursorName = "move";
    }
    else if (curInfo.hCursor == notAllowedCursor)
    {
        cursorName = "not-allowed";
    }
    else if (curInfo.hCursor == pointerCursor)
    {
        cursorName = "pointer";
    }
    else if (curInfo.hCursor == progressCursor)
    {
        cursorName = "progress";
    }

    // If not WM_MOUSEMOVE or WM_MOUSEMOVE has been requested, process event
    if (!(wParam == WM_MOUSEMOVE && !g_captureMouseMove.load()))
    {
        // Prepare data to be processed
        MSLLHOOKSTRUCT *data = (MSLLHOOKSTRUCT *)lParam;
        auto pMouseEvent = new MouseEventContext();

        // Add null check for allocation failure
        if (!pMouseEvent)
        {
            return CallNextHookEx(NULL, nCode, wParam, lParam);
        }

        auto now = std::chrono::system_clock::now();
        auto duration = now.time_since_epoch();

        pMouseEvent->nCode = nCode;
        pMouseEvent->wParam = wParam;
        pMouseEvent->ptX = data->pt.x;
        pMouseEvent->ptY = data->pt.y;
        pMouseEvent->mouseData = data->mouseData;
        pMouseEvent->cursor = cursorName;
        pMouseEvent->timestamp = std::chrono::duration_cast<std::chrono::milliseconds>(duration).count();

        // CRITICAL: Check if NonBlockingCall succeeds to prevent memory leaks
        auto result = g_tsfn.NonBlockingCall(pMouseEvent, onMainThread);
        if (result != napi_ok)
        {
            // If call fails, we must clean up ourselves
            delete pMouseEvent;
        }
    }

    // Let Windows continue with this event as normal
    return CallNextHookEx(NULL, nCode, wParam, lParam);
}

DWORD WINAPI MouseHookThread(LPVOID lpParam)
{

    MSG msg;
    HHOOK hook = g_installEventHook.load() ? SetWindowsHookEx(WH_MOUSE_LL, HookCallback, NULL, 0) : NULL;

    while (!g_shutdownRequested.load() && GetMessage(&msg, NULL, 0, 0) > 0)
    {
        if (msg.message == WM_QUIT)
        {
            break;
        }

        if (msg.message != WM_USER)
            continue;

        if (!g_installEventHook.load() && hook != NULL)
        {
            if (UnhookWindowsHookEx(hook))
            {
                hook = NULL;
            }
        }
        else if (g_installEventHook.load() && hook == NULL)
        {
            hook = SetWindowsHookEx(WH_MOUSE_LL, HookCallback, NULL, 0);
            if (hook == NULL)
                break;
        }
    }

    // Ensure hook is removed before thread exits
    if (hook != NULL)
    {
        UnhookWindowsHookEx(hook);
    }

    // Signal shutdown and cleanup
    g_shutdownRequested = true;
    g_tsfn.Release();

    // Signal that thread is about to exit
    if (g_hThreadExitEvent != NULL)
    {
        SetEvent(g_hThreadExitEvent);
    }

    return 0;
}

Napi::Boolean createMouseHook(const Napi::CallbackInfo &info)
{
    // Initialize cursor handles if not already done
    static bool cursorsInitialized = false;
    if (!cursorsInitialized)
    {
        if (!InitializeCursorHandles())
        {
            std::cerr << "[cursor-events] ERROR: Failed to initialize cursor handles" << std::endl;
            return Napi::Boolean::New(info.Env(), false);
        }
        cursorsInitialized = true;
    }

    // Reset shutdown flag
    g_shutdownRequested = false;

    // Create event for thread synchronization
    g_hThreadExitEvent = CreateEvent(NULL, TRUE, FALSE, NULL); // Manual reset, initially non-signaled
    if (g_hThreadExitEvent == NULL)
    {
        std::cerr << "[cursor-events] ERROR: Failed to create thread exit event, error code: " << GetLastError() << std::endl;
        return Napi::Boolean::New(info.Env(), false);
    }

    g_hThread = CreateThread(NULL, 0, MouseHookThread, NULL, CREATE_SUSPENDED, &g_dwThreadID);
    if (g_hThread == NULL)
    {
        std::cerr << "[cursor-events] ERROR: Failed to create mouse hook thread, error code: " << GetLastError() << std::endl;
        CloseHandle(g_hThreadExitEvent);
        g_hThreadExitEvent = NULL;
        return Napi::Boolean::New(info.Env(), false);
    }

    g_tsfn = Napi::ThreadSafeFunction::New(
        info.Env(),
        info[0].As<Napi::Function>(),
        "WH_MOUSE_LL Hook Thread",
        512,
        1,
        [](Napi::Env)
        {
            // Request graceful shutdown
            g_shutdownRequested = true;
            if (g_dwThreadID != 0)
            {
                PostThreadMessageW(g_dwThreadID, WM_QUIT, 0, 0);

                // Wait for thread to signal completion, with reasonable timeout
                DWORD waitResult = WAIT_FAILED; // Initialize to failed state
                if (g_hThreadExitEvent != NULL)
                {
                    waitResult = WaitForSingleObject(g_hThreadExitEvent, 5000); // 5 second max

                    if (waitResult == WAIT_TIMEOUT)
                    {
                        // Thread didn't exit gracefully within timeout
                        // This suggests the thread is stuck - we need to force cleanup
                        // Note: We avoid TerminateThread() as it's dangerous with hooks
                        // Instead, we'll proceed with cleanup and let the OS handle it

                        std::cerr << "[cursor-events] CRITICAL: Thread shutdown timeout after 5 seconds - thread may be stuck" << std::endl;
                        g_shutdownRequested = true; // Ensure flag is set

                        // The thread might still be running, but we can't wait forever
                        // Proceeding with handle cleanup is the safest option
                    }

                    CloseHandle(g_hThreadExitEvent);
                    g_hThreadExitEvent = NULL;
                }

                if (g_hThread != NULL)
                {
                    if (waitResult == WAIT_TIMEOUT)
                    {
                        // Thread didn't respond to graceful shutdown
                        // Give it one more very brief chance, then force cleanup
                        DWORD finalWait = WaitForSingleObject(g_hThread, 250); // 250ms final chance

                        if (finalWait == WAIT_TIMEOUT)
                        {
                            // Thread is truly stuck - this is an error condition
                            // We cannot safely use TerminateThread() with Windows hooks
                            // Best we can do is close our handle and let the OS clean up eventually

                            std::cerr << "[cursor-events] CRITICAL: Thread completely unresponsive - forcing cleanup, potential resource leak" << std::endl;
                            // In a production environment, you might:
                            // 1. Log this as a critical error
                            // 2. Report to crash analytics
                            // 3. Consider restarting the entire process
                        }
                    }
                    else
                    {
                        // Thread exited gracefully, this should return immediately
                        WaitForSingleObject(g_hThread, 100); // Very short timeout since thread should be done
                    }

                    CloseHandle(g_hThread);
                    g_hThread = NULL;
                }
            }
        });

    ResumeThread(g_hThread);
    return Napi::Boolean::New(info.Env(), true);
}

void enableMouseMove(const Napi::CallbackInfo &info)
{
    g_captureMouseMove = true;
}

void disableMouseMove(const Napi::CallbackInfo &info)
{
    g_captureMouseMove = false;
}

Napi::Boolean pauseMouseEvents(const Napi::CallbackInfo &info)
{
    BOOL bDidPost = FALSE;
    if (g_dwThreadID != 0)
    {
        g_installEventHook = false;
        bDidPost = PostThreadMessageW(g_dwThreadID, WM_USER, NULL, NULL);
    }
    return Napi::Boolean::New(info.Env(), bDidPost);
}

Napi::Number resumeMouseEvents(const Napi::CallbackInfo &info)
{
    BOOL bDidPost = FALSE;
    if (g_dwThreadID != 0)
    {
        g_installEventHook = true;
        bDidPost = PostThreadMessageW(g_dwThreadID, WM_USER, NULL, NULL);
    }

    if (bDidPost)
    {
        auto now = std::chrono::system_clock::now();
        auto duration = now.time_since_epoch();
        long long timestamp = std::chrono::duration_cast<std::chrono::milliseconds>(duration).count();
        return Napi::Number::New(info.Env(), timestamp);
    }
    else
    {
        return Napi::Number::New(info.Env(), -1);
    }
}

Napi::Object Init(Napi::Env env, Napi::Object exports)
{
    exports.Set(Napi::String::New(env, "createMouseHook"),
                Napi::Function::New(env, createMouseHook));

    exports.Set(Napi::String::New(env, "enableMouseMove"),
                Napi::Function::New(env, enableMouseMove));

    exports.Set(Napi::String::New(env, "disableMouseMove"),
                Napi::Function::New(env, disableMouseMove));

    exports.Set(Napi::String::New(env, "pauseMouseEvents"),
                Napi::Function::New(env, pauseMouseEvents));

    exports.Set(Napi::String::New(env, "resumeMouseEvents"),
                Napi::Function::New(env, resumeMouseEvents));

    return exports;
}

NODE_API_MODULE(NODE_GYP_MODULE_NAME, Init)
