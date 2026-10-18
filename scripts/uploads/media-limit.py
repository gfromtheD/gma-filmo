#!/usr/bin/env python3
"""Fixed argv execution, no shell; production caller adds network/filesystem namespaces."""
import argparse
import os
import resource
import sys
p = argparse.ArgumentParser()
p.add_argument('--cpu', type=int, required=True)
p.add_argument('--memory', type=int, required=True)
p.add_argument('--file', type=int, required=True)
p.add_argument('command', nargs=argparse.REMAINDER)
a = p.parse_args()
command = a.command[1:] if a.command[0] == '--' else a.command
resource.setrlimit(resource.RLIMIT_CPU, (a.cpu, a.cpu))
# macOS does not enforce RLIMIT_AS reliably; only trusted fixture tests run here.
if sys.platform == 'linux':
    resource.setrlimit(resource.RLIMIT_AS, (a.memory, a.memory))
resource.setrlimit(resource.RLIMIT_FSIZE, (a.file, a.file))
resource.setrlimit(resource.RLIMIT_NOFILE, (128, 128))
resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
os.execv(command[0], command)
