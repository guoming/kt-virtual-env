// [AI-GEN] scope:ipc/hide_window_windows, model:auto, reviewed:false
//go:build windows

package ipc

import (
	"os/exec"
	"syscall"
)

const createNoWindow = 0x08000000

func applyHideConsoleWindow(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{
		HideWindow:    true,
		CreationFlags: createNoWindow,
	}
}
// [/AI-GEN]
