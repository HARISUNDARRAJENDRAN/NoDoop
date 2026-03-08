package p2p

import "testing"

func TestTCPTransportInit(t *testing.T) {
	opts := TCPTransportOpts{
		ListenAddr:    "127.0.0.1:0",
		HandshakeFunc: NOPHandshakeFunc,
		Decoder:       DefaultDecoder{},
	}

	tr := NewTCPTransport(opts)
	if tr.ListenAddr != opts.ListenAddr {
		t.Fatalf("listen addr mismatch: have %s want %s", tr.ListenAddr, opts.ListenAddr)
	}

	if err := tr.ListenAndAccept(); err != nil {
		t.Fatalf("listen failed: %v", err)
	}

	if err := tr.Close(); err != nil {
		t.Fatalf("close failed: %v", err)
	}
}
