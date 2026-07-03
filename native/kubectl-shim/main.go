// [AI-GEN] scope:kubectl-shim, model:auto, reviewed:false
//go:build windows

package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"syscall"
)

const createNoWindow = 0x08000000

func main() {
	exe, err := os.Executable()
	if err != nil {
		fmt.Fprintf(os.Stderr, "kubectl shim: %v\n", err)
		os.Exit(1)
	}
	realKubectl := filepath.Join(filepath.Dir(exe), "kubectl.real.exe")
	cmd := exec.Command(realKubectl, os.Args[1:]...)
	cmd.Stdin = os.Stdin
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	cmd.SysProcAttr = &syscall.SysProcAttr{
		HideWindow:    true,
		CreationFlags: createNoWindow,
	}
	if err := cmd.Run(); err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			os.Exit(exitErr.ExitCode())
		}
		fmt.Fprintf(os.Stderr, "kubectl shim: %v\n", err)
		os.Exit(1)
	}
}
// [/AI-GEN]
