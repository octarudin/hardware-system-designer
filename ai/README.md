# AI

Standalone datasheet-import worker process.

M0 supplies only lifecycle and shutdown behavior. It does not poll jobs, parse PDFs, call a provider, or publish components. Those capabilities are introduced behind explicit ports in M7.
