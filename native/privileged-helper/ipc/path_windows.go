// [AI-GEN] scope:ipc/path_windows, model:auto, reviewed:false
//go:build windows

package ipc

import (
	"os"
	"path/filepath"
)

func ensurePlatformPath(env []string) []string {
	systemRoot := os.Getenv("SystemRoot")
	if systemRoot == "" {
		systemRoot = os.Getenv("WINDIR")
	}
	if systemRoot == "" {
		systemRoot = `C:\Windows`
	}
	dirs := []string{
		filepath.Join(systemRoot, "System32"),
		filepath.Join(systemRoot, "Sysnative"),
		filepath.Join(systemRoot, "System32", "Wbem"),
		filepath.Join(systemRoot, "System32", "WindowsPowerShell", "v1.0"),
	}
	for _, dir := range dirs {
		env = prependPathDir(env, dir)
	}
	return env
}

// [/AI-GEN]
