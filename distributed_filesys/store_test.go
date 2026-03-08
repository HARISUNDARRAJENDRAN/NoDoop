package dfs

import (
	"bytes"
	"fmt"
	"io"
	"testing"
)

func TestPathTransformFunc(t *testing.T) {
	key := "momsbestpicture"
	pathKey := CASPathTransformFunc(key)

	expectedFilename := "6804429f74181a63c50c3d81d733a12f14a353ff"
	if pathKey.Filename != expectedFilename {
		t.Fatalf("have %s want %s", pathKey.Filename, expectedFilename)
	}

	if pathKey.PathName == "" {
		t.Fatal("expected non-empty path name")
	}
}

func TestStoreWriteReadDelete(t *testing.T) {
	s := newStore()
	id := generateID()
	t.Cleanup(func() { _ = s.Clear() })

	for i := 0; i < 10; i++ {
		key := fmt.Sprintf("foo_%d", i)
		data := []byte("some file bytes")

		if _, err := s.Write(id, key, bytes.NewReader(data)); err != nil {
			t.Fatalf("write failed: %v", err)
		}

		if ok := s.Has(id, key); !ok {
			t.Fatalf("expected to have key %s", key)
		}

		_, r, err := s.Read(id, key)
		if err != nil {
			t.Fatalf("read failed: %v", err)
		}

		b, _ := io.ReadAll(r)
		if string(b) != string(data) {
			t.Fatalf("want %s have %s", data, b)
		}

		if rc, ok := r.(io.ReadCloser); ok {
			_ = rc.Close()
		}

		if err := s.Delete(id, key); err != nil {
			t.Fatalf("delete failed: %v", err)
		}

		if ok := s.Has(id, key); ok {
			t.Fatalf("expected key %s to be deleted", key)
		}
	}
}

func TestCopyEncryptDecrypt(t *testing.T) {
	payload := "Foo not bar"
	src := bytes.NewReader([]byte(payload))
	dst := new(bytes.Buffer)

	key := newEncryptionKey()
	if _, err := copyEncrypt(key, src, dst); err != nil {
		t.Fatalf("encrypt failed: %v", err)
	}

	out := new(bytes.Buffer)
	nw, err := copyDecrypt(key, dst, out)
	if err != nil {
		t.Fatalf("decrypt failed: %v", err)
	}

	if nw != 16+len(payload) {
		t.Fatalf("unexpected decrypted byte count: %d", nw)
	}

	if out.String() != payload {
		t.Fatalf("decryption mismatch: want %s have %s", payload, out.String())
	}
}

func newStore() *Store {
	return NewStore(StoreOpts{PathTransformFunc: CASPathTransformFunc, Root: "nodoop_test_store"})
}
