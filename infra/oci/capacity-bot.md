# OCI Ampere Capacity Bot

Use this when Hyderabad A1 capacity is temporarily unavailable.

## Prerequisites

- OCI CLI configured (`oci setup config`)
- API key with permissions for Compute + Networking
- Existing VCN/Subnet/Security list in target region

## Recommended open-source helper

- [`hitrov/oci-arm-host-capacity`](https://github.com/hitrov/oci-arm-host-capacity)

## Typical loop

1. Configure `config.yml` with:
   - region: `ap-hyderabad-1`
   - shape: `VM.Standard.A1.Flex`
   - ocpus: `4`
   - memory: `24`
2. Run polling loop every 30-60 seconds.
3. On first successful launch, stop bot and snapshot VM config.

## Fallback policy

If capacity is unavailable for more than 4 days:
- move to Hetzner CX22 fallback for Judge0, keep Cloudflare stack unchanged.
