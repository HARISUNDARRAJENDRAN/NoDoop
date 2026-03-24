package main

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"

	dfs "nodoop/distributed_filesys"
)

type bridge struct {
	store  *dfs.Store
	nodeID string
}

func newBridge() *bridge {
	root := os.Getenv("DFS_BRIDGE_ROOT")
	if root == "" {
		root = "dfs_bridge_data"
	}

	nodeID := os.Getenv("DFS_BRIDGE_NODE_ID")
	if nodeID == "" {
		nodeID = "bridge-node"
	}

	store := dfs.NewStore(dfs.StoreOpts{
		Root:              root,
		PathTransformFunc: dfs.CASPathTransformFunc,
	})

	return &bridge{store: store, nodeID: nodeID}
}

func (b *bridge) blobKeyFromRequest(r *http.Request) (string, error) {
	const prefix = "/v1/blobs/"
	if !strings.HasPrefix(r.URL.Path, prefix) {
		return "", fmt.Errorf("invalid blob path")
	}

	raw := strings.TrimPrefix(r.URL.Path, prefix)
	decoded, err := url.PathUnescape(raw)
	if err != nil {
		return "", err
	}
	decoded = strings.TrimSpace(decoded)
	if decoded == "" {
		return "", fmt.Errorf("blob key is required")
	}

	return filepath.ToSlash(decoded), nil
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func (b *bridge) handleHealth(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"ok":      true,
		"service": "dfs-bridge",
		"nodeId":  b.nodeID,
	})
}

func (b *bridge) handlePutBlob(w http.ResponseWriter, r *http.Request) {
	key, err := b.blobKeyFromRequest(r)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	n, err := b.store.Write(b.nodeID, key, r.Body)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusCreated, map[string]any{
		"key":   key,
		"bytes": n,
	})
}

func (b *bridge) handleGetBlob(w http.ResponseWriter, r *http.Request) {
	key, err := b.blobKeyFromRequest(r)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	_, reader, err := b.store.Read(b.nodeID, key)
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "blob not found"})
		return
	}

	if rc, ok := reader.(io.ReadCloser); ok {
		defer rc.Close()
	}

	w.Header().Set("Content-Type", "application/octet-stream")
	_, _ = io.Copy(w, reader)
}

func (b *bridge) handleBlobs(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodPost:
		b.handlePutBlob(w, r)
	case http.MethodGet:
		b.handleGetBlob(w, r)
	default:
		w.Header().Set("Allow", "GET, POST")
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
	}
}

func main() {
	// Render and other hosts set PORT; local dev can use DFS_BRIDGE_PORT or default 9090.
	port := os.Getenv("PORT")
	if port == "" {
		port = os.Getenv("DFS_BRIDGE_PORT")
	}
	if port == "" {
		port = "9090"
	}

	b := newBridge()
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", b.handleHealth)
	mux.HandleFunc("/v1/blobs/", b.handleBlobs)

	log.Printf("dfs bridge listening on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, mux))
}
