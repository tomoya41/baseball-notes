/^Active default network:/ { active=$NF; sub(/\r$/, "", active) }
/^Current Networks:/ { networks=1; next }
/^Network Requests:/ { networks=0 }
networks && active ~ /^[0-9]+$/ && index($0, "NetworkAgentInfo{network{" active "}") {
  split($0, parts, " nc[{]")
  if (parts[2] ~ /(^|[& :])VALIDATED([& ]|$)/) validated=1
}
END { exit !validated }
