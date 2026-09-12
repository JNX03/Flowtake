// Win32 extended styles are stable flag values from winuser.h. Keep layered
// application windows eligible: transparency used for rounded corners/shadows
// does not make a window an overlay.
pub(super) const WS_EX_TRANSPARENT: u32 = 0x0000_0020;
pub(super) const WS_EX_TOOLWINDOW: u32 = 0x0000_0080;

pub(super) fn is_pickable_window(
    visible: bool,
    minimized: bool,
    cloaked: bool,
    extended_style: u32,
) -> bool {
    visible
        && !minimized
        && !cloaked
        && extended_style & (WS_EX_TRANSPARENT | WS_EX_TOOLWINDOW) == 0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn transparent_cursor_overlay_does_not_hide_the_app_below_it() {
        // EnumWindows is ordered front-to-back. A full-desktop cursor overlay
        // has a matching rectangle too, but only the underlying app is eligible.
        let overlay_styles = 0x0808_00a8; // noactivate, layered, tool, transparent, topmost
        let candidates = [overlay_styles, 0x0004_0000]; // ordinary appwindow
        let picked = candidates
            .iter()
            .position(|style| is_pickable_window(true, false, false, *style));
        assert_eq!(picked, Some(1));
    }

    #[test]
    fn tool_and_click_through_windows_are_not_recording_targets() {
        for style in [WS_EX_TOOLWINDOW, WS_EX_TRANSPARENT, 0x0008_0020] {
            assert!(!is_pickable_window(true, false, false, style));
        }
    }

    #[test]
    fn regular_layered_and_always_on_top_apps_remain_selectable() {
        for style in [0, 0x0004_0000, 0x0008_0000, 0x0008_0008] {
            assert!(is_pickable_window(true, false, false, style));
        }
    }

    #[test]
    fn hidden_minimized_or_cloaked_windows_do_not_win_hit_testing() {
        assert!(!is_pickable_window(false, false, false, 0));
        assert!(!is_pickable_window(true, true, false, 0));
        assert!(!is_pickable_window(true, false, true, 0));
    }
}
