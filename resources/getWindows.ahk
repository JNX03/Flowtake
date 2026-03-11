#SingleInstance Force
#Include _JXON.ahk

windowList := WinGetList()
windows := []

for index, windowId in windowList {
    title := WinGetTitle(windowId)

    if WinExist(title) {
        WinGetClientPos &X, &Y, &W, &H, title

        window := Map()
        window["name"] := title
        window["x"] := X
        window["y"] := Y
        window["width"] := W
        window["height"] := H
        window["type"] := "window"
        window["id"] := String(windowId)

        windows.Push(window)
    }
}

output := Map()
output["windows"] := windows
json := jxon_dump(output)

FileAppend json, "*", "UTF-8"