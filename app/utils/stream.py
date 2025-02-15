"""Streaming utilities for the application."""

async def stream_with_context(generator):
    """
    Wraps an async generator to ensure proper context management.
    
    Args:
        generator: An async generator that yields response chunks
        
    Returns:
        An async generator that properly manages the context
    """
    try:
        async for chunk in generator:
            yield chunk
    except Exception as e:
        # Log the error but don't re-raise to ensure graceful stream closure
        import logging
        logging.error(f"Error in stream: {str(e)}")
        yield f"Error: {str(e)}"
    finally:
        if hasattr(generator, 'aclose'):
            await generator.aclose() 