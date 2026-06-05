// [AI-GEN] scope:ipc/handler, model:auto, reviewed:false
package ipc

import (
	"bufio"
	"io"
	"os/exec"
	"sync"
)

var (
	connectCmd *exec.Cmd
	mu         sync.Mutex
)

func HandleConnect(ktctlPath string, args []string, onLog func(line string)) error {
	mu.Lock()
	defer mu.Unlock()
	if connectCmd != nil && connectCmd.Process != nil {
		return nil
	}
	connectCmd = exec.Command(ktctlPath, args...)
	stdout, err := connectCmd.StdoutPipe()
	if err != nil {
		return err
	}
	stderr, err := connectCmd.StderrPipe()
	if err != nil {
		return err
	}
	if err := connectCmd.Start(); err != nil {
		return err
	}
	if onLog != nil {
		go streamLogs(stdout, onLog)
		go streamLogs(stderr, onLog)
	}
	return nil
}

func streamLogs(r io.Reader, onLog func(line string)) {
	scanner := bufio.NewScanner(r)
	for scanner.Scan() {
		onLog(scanner.Text())
	}
}

func HandleDisconnect() error {
	mu.Lock()
	defer mu.Unlock()
	if connectCmd != nil && connectCmd.Process != nil {
		_ = connectCmd.Process.Kill()
		connectCmd = nil
	}
	return nil
}

func Shutdown() {
	_ = HandleDisconnect()
}
// [/AI-GEN]
