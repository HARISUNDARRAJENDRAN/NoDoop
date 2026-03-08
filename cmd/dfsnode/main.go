package main

import (
	"bytes"
	"flag"
	"fmt"
	"io"
	"log"
	"strings"
	"time"

	"nodoop/dfs"
	"nodoop/dfs/p2p"
)

func makeServer(listenAddr string, encKey []byte, nodes ...string) *dfs.FileServer {
	tcpTransport := p2p.NewTCPTransport(p2p.TCPTransportOpts{
		ListenAddr:    listenAddr,
		HandshakeFunc: p2p.NOPHandshakeFunc,
		Decoder:       p2p.DefaultDecoder{},
	})

	server := dfs.NewFileServer(dfs.FileServerOpts{
		EncKey:            encKey,
		StorageRoot:       strings.NewReplacer(":", "", ".", "").Replace(listenAddr) + "_dfs",
		PathTransformFunc: dfs.CASPathTransformFunc,
		Transport:         tcpTransport,
		BootstrapNodes:    nodes,
	})

	tcpTransport.OnPeer = server.OnPeer
	return server
}

func main() {
	mode := flag.String("mode", "single", "single | demo3")
	listen := flag.String("listen", ":3000", "listen address in single mode")
	boot := flag.String("bootstrap", "", "comma-separated bootstrap nodes for single mode")
	flag.Parse()

	sharedKey := []byte("0123456789abcdef0123456789abcdef")

	switch *mode {
	case "single":
		var nodes []string
		if strings.TrimSpace(*boot) != "" {
			nodes = strings.Split(*boot, ",")
		}

		s := makeServer(*listen, sharedKey, nodes...)
		log.Fatal(s.Start())

	case "demo3":
		s1 := makeServer(":3001", sharedKey)
		s2 := makeServer(":3002", sharedKey)
		s3 := makeServer(":3003", sharedKey, ":3001", ":3002")

		go func() { log.Fatal(s1.Start()) }()
		time.Sleep(300 * time.Millisecond)
		go func() { log.Fatal(s2.Start()) }()

		time.Sleep(1 * time.Second)
		go func() { log.Fatal(s3.Start()) }()

		time.Sleep(2 * time.Second)

		key := "hello.txt"
		if err := s3.Store(key, bytes.NewReader([]byte("hello from nodoop dfs"))); err != nil {
			log.Fatal(err)
		}

		r, err := s3.Get(key)
		if err != nil {
			log.Fatal(err)
		}

		b, err := io.ReadAll(r)
		if err != nil {
			log.Fatal(err)
		}

		fmt.Println(string(b))
		select {}

	default:
		log.Fatalf("unknown mode: %s", *mode)
	}
}
