#SingleInstance Force
try {
    WinGetClientPos &X, &Y, &W, &H, "ahk_id " A_Args[1]
    FileAppend "{`"x`": " X ", `"y`": " Y ", `"width`": " W ", `"height`": " H "}", "*", "UTF-8"
} catch TargetError as err {
    FileAppend "{`"error`": `"TargetError`"}", "*", "UTF-8"
}
