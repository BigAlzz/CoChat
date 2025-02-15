from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from io import BytesIO
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

class PDFRequest(BaseModel):
    content: str

@router.post("/pdf")
async def generate_pdf(request: PDFRequest) -> Response:
    try:
        # Create a BytesIO buffer to receive PDF data
        buffer = BytesIO()
        
        # Create the PDF document
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            rightMargin=72,
            leftMargin=72,
            topMargin=72,
            bottomMargin=72
        )
        
        # Get styles
        styles = getSampleStyleSheet()
        
        # Create custom style for the content
        content_style = ParagraphStyle(
            'CustomStyle',
            parent=styles['Normal'],
            fontSize=11,
            spaceAfter=12,
            leading=14
        )
        
        # Create the PDF content
        story = []
        
        # Add title
        title = Paragraph("Conversation Summary", styles['Title'])
        story.append(title)
        story.append(Spacer(1, 24))
        
        # Add content paragraphs
        # Split content by newlines and create paragraphs
        for paragraph in request.content.split('\n'):
            if paragraph.strip():  # Skip empty lines
                p = Paragraph(paragraph, content_style)
                story.append(p)
                story.append(Spacer(1, 6))
        
        # Build the PDF
        doc.build(story)
        
        # Get the value from the BytesIO buffer
        pdf_data = buffer.getvalue()
        buffer.close()
        
        # Return the PDF as a response
        return Response(
            content=pdf_data,
            media_type="application/pdf",
            headers={
                "Content-Disposition": "attachment; filename=conversation_summary.pdf"
            }
        )
        
    except Exception as e:
        logger.error(f"Error generating PDF: {e}")
        raise HTTPException(status_code=500, detail=str(e)) 