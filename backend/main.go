package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
)

// Add this middleware function to handle CORS
func enableCors(handler http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Set CORS headers
		w.Header().Set("Access-Control-Allow-Origin", "http://localhost:3000")
		w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

		// Handle preflight OPTIONS request
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		handler(w, r)
	}
}

type ParseRequest struct {
	Input string `json:"input"`
}

type ParseResponse struct {
	Type      string    `json:"type"`      // "plane" or "direction"
	Indices   []float64 `json:"indices"`   // parsed Miller indices
	Intercept []float64 `json:"intercept"` // for planes, compute intercept as 1/index (or default value)
}

func parseHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Invalid request method", http.StatusMethodNotAllowed)
		return
	}

	var req ParseRequest
	err := json.NewDecoder(r.Body).Decode(&req)
	if err != nil {
		http.Error(w, "Error parsing JSON", http.StatusBadRequest)
		return
	}

	input := strings.TrimSpace(req.Input)
	var res ParseResponse

	if strings.HasPrefix(input, "(") && strings.HasSuffix(input, ")") {
		// Handle plane input, e.g. (100) or (110)
		content := strings.TrimSuffix(strings.TrimPrefix(input, "("), ")")
		var indices []float64
		// Assume input is given as a string of digits (and possibly a '-' sign for negatives)
		i := 0
		for i < len(content) {
			// Check for negative sign
			sign := 1.0
			if content[i] == '-' {
				sign = -1.0
				i++
			}
			if i < len(content) && content[i] >= '0' && content[i] <= '9' {
				// In this simple parser, we assume one-digit numbers
				val, _ := strconv.Atoi(string(content[i]))
				indices = append(indices, sign*float64(val))
				i++
			} else {
				i++
			}
		}
		if len(indices) == 0 {
			http.Error(w, "No valid indices found", http.StatusBadRequest)
			return
		}
		res.Type = "plane"
		res.Indices = indices
		// For a simple visualization, compute “intercepts” for each axis.
		// (if an index is 0, default to 0.5 so the plane will be centered in that direction)
		intercepts := make([]float64, len(indices))
		for i, v := range indices {
			if v != 0 {
				intercepts[i] = 1.0 / v
			} else {
				intercepts[i] = 0.5
			}
		}
		res.Intercept = intercepts

	} else if strings.HasPrefix(input, "[") && strings.HasSuffix(input, "]") {
		// Handle direction input, e.g. [111]
		content := strings.TrimSuffix(strings.TrimPrefix(input, "["), "]")
		var indices []float64
		i := 0
		for i < len(content) {
			sign := 1.0
			if content[i] == '-' {
				sign = -1.0
				i++
			}
			if i < len(content) && content[i] >= '0' && content[i] <= '9' {
				val, _ := strconv.Atoi(string(content[i]))
				indices = append(indices, sign*float64(val))
				i++
			} else {
				i++
			}
		}
		if len(indices) == 0 {
			http.Error(w, "No valid indices found", http.StatusBadRequest)
			return
		}
		res.Type = "direction"
		res.Indices = indices
	} else {
		http.Error(w, "Invalid format. Use parentheses for planes (e.g., (100)) or brackets for directions (e.g., [111]).", http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(res)
}

func main() {
	http.HandleFunc("/api/parse", enableCors(parseHandler))
	fmt.Println("Go server running on port 8081...")
	log.Fatal(http.ListenAndServe(":8081", nil))
}
