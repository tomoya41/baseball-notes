#!/usr/bin/env bash
set -euo pipefail
# Synthetic emulator diagnostic text, never application or baseball data.
parser=scripts/android-default-network-validated.awk
printf '%s\n' 'Active default network: 108' 'Current Networks:' \
  'NetworkAgentInfo{network{108} Score(IS_VALIDATED) nc{[ Capabilities: INTERNET&VALIDATED&NOT_VPN ]}' \
  'Network Requests:' | awk -f "$parser"
# Long dumps must be consumed without pipefail/SIGPIPE or a false failure.
{ printf '%s\n' 'Active default network: 108' 'Current Networks:' \
  'NetworkAgentInfo{network{108} nc{[ Capabilities: INTERNET&VALIDATED&NOT_VPN ]}';
  for n in $(seq 1 4000); do printf 'LISTEN id=%s requesting VALIDATED\n' "$n"; done;
  printf '%s\n' 'Network Requests:';
} | awk -f "$parser"
for mode in secondary request none policy_only; do
  if {
    printf '%s\n' "Active default network: $([[ $mode == none ]] && echo none || echo 108)" 'Current Networks:'
    printf '%s\n' 'NetworkAgentInfo{network{108} Score(EVER_VALIDATED&IS_VALIDATED) nc{[ Capabilities: INTERNET&NOT_VPN ]}'
    if [[ $mode == secondary ]]; then printf '%s\n' 'NetworkAgentInfo{network{107} nc{[ Capabilities: INTERNET&VALIDATED&NOT_VPN ]}'; fi
    printf '%s\n' 'Network Requests:' 'NetworkRequest asking for VALIDATED'
  } | awk -f "$parser"; then echo "False online result: $mode" >&2; exit 1; fi
done
echo 'PASS default-network validation, long dump, non-default/request/offline rejection'
