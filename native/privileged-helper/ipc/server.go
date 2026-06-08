// [AI-GEN] scope:ipc/server, model:auto, reviewed:false
package ipc

import (
	"bufio"
	"encoding/json"
	"net"
	"os"
	"strings"
)

type MessageHandler func(conn net.Conn, msg map[string]any) error

func Serve(endpoint string, handler MessageHandler) error {
	var ln net.Listener
	var err error
	if strings.HasPrefix(endpoint, "tcp:") {
		ln, err = net.Listen("tcp", strings.TrimPrefix(endpoint, "tcp:"))
	} else {
		ln, err = net.Listen("unix", endpoint)
		if err == nil {
			_ = os.Chmod(endpoint, 0o666)
		}
	}
	if err != nil {
		return err
	}
	for {
		conn, err := ln.Accept()
		if err != nil {
			continue
		}
		go handleConn(conn, handler)
	}
}

func handleConn(conn net.Conn, handler MessageHandler) {
	defer conn.Close()
	scanner := bufio.NewScanner(conn)
	for scanner.Scan() {
		var msg map[string]any
		if err := json.Unmarshal(scanner.Bytes(), &msg); err != nil {
			continue
		}
		if err := handler(conn, msg); err != nil {
			_ = WriteEvent(conn, map[string]any{"event": "error", "message": err.Error()})
		}
	}
}

func WriteEvent(conn net.Conn, event any) error {
	b, err := json.Marshal(event)
	if err != nil {
		return err
	}
	_, err = conn.Write(append(b, '\n'))
	return err
}
// [/AI-GEN]
