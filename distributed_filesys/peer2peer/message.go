package p2p

const (
	IncomingMessage = 0x1
	IncomingStream  = 0x2
)

// RPC is a generic frame exchanged between peers.
type RPC struct {
	From    string
	Payload []byte
	Stream  bool
}
