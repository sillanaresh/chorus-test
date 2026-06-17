#!/bin/sh

# Written by Gemini 2.5 Pro on 2025-05-01

# Simple script to execute a target binary specified by the first argument,
# passing through any subsequent arguments and stdin/stdout/stderr.

# Ensure at least one argument (the path to the executable) is provided.
if [ "$#" -lt 1 ]; then
  echo "Usage: run-mcp <path_to_command> [args_for_executable...]" >&2
  exit 1
fi

TARGET_EXEC="$1"
shift # Remove the first argument (the path), leaving only args for the target

# Basic check: does the target exist and is it executable?
if ! command -v "$TARGET_EXEC" > /dev/null 2>&1; then
  echo "run-mcp: Error: Command not found in PATH: '$TARGET_EXEC'" >&2
  exit 127 # Standard "command not found" exit code
fi

# Execute the target executable, passing through remaining arguments.
# Stdin, stdout, and stderr are automatically passed through.
# The script will exit with the exit code of the target executable.
exec "$TARGET_EXEC" "$@"

# Note: 'exec' replaces the current shell process with the target executable.
# If the target executable starts successfully, the lines below this 'exec'
# will not be reached. If 'exec' fails (e.g., permission denied even after -x check),
# the shell might print an error and exit.