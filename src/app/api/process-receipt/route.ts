import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

// Debug log environment variables
console.log('Environment variables:', {
  hasGoogleApiKey: !!process.env.GOOGLE_AI_API_KEY,
  keyLength: process.env.GOOGLE_AI_API_KEY?.length,
  keyPrefix: process.env.GOOGLE_AI_API_KEY?.substring(0, 5) + '...',
  nodeEnv: process.env.NODE_ENV,
  allEnvKeys: Object.keys(process.env).filter(key => key.includes('GOOGLE') || key.includes('NEXT_'))
});

// Check if API key is present
if (!process.env.GOOGLE_AI_API_KEY) {
  console.error('GOOGLE_AI_API_KEY is not set in environment variables');
  throw new Error('Server configuration error: Missing API key');
}

// Initialize the Google AI client
const ai = new GoogleGenAI({
  apiKey: process.env.GOOGLE_AI_API_KEY
});

// Test the API key by creating a simple model instance
try {
  console.log('Initializing Google AI client...');
  console.log('API Key present:', !!process.env.GOOGLE_AI_API_KEY);
  
  // Just verify the client was created successfully
  console.log('Google AI client initialized successfully');
} catch (error: any) {
  console.error('Failed to initialize Google AI client:', error);
  console.error('Error details:', error?.message || 'Unknown error');
  // Don't throw here, let the POST function handle initialization errors
}

// Helper function to convert base64 to the format expected by GoogleGenAI
function base64ToGenerativePart(base64String: string, mimeType: string) {
  try {
    // Handle both data URLs and raw base64 strings
    const base64Data = base64String.includes(',') 
      ? base64String.split(',')[1] 
      : base64String;
      
    return {
      inlineData: {
        data: base64Data,
        mimeType: mimeType || 'image/jpeg',
      },
    };
  } catch (error) {
    console.error('Error in base64ToGenerativePart:', error);
    throw new Error('Invalid image data format');
  }
}

// Helper function to safely parse JSON
function safeJsonParse(jsonString: string): any {
  try {
    return JSON.parse(jsonString);
  } catch (e) {
    console.error('Error parsing JSON:', e);
    console.error('Problematic JSON string:', jsonString);
    const jsonMatch = jsonString.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (innerError) {
        console.error('Failed to parse extracted JSON:', innerError);
      }
    }
    throw new Error('Invalid JSON format in response');
  }
}

export async function POST(request: Request) {
  const requestStartTime = Date.now();
  
  try {
    console.log('=== New Receipt Processing Request ===');
    
    // Parse request body
    const body = await request.json();
    const { imageData } = body;
    
    if (!imageData) {
      return NextResponse.json(
        { 
          error: 'Missing required field',
          message: 'The imageData field is required in the request body'
        },
        { status: 400 }
      );
    }

    console.log('Request validated, processing image data...');
    
    // Initialize the model and generate content
    console.log('Initializing Gemini model...');

    // Prepare the prompt
    const prompt = `You are an expert at extracting receipt information. 
    Extract all food and drink items, their quantities, prices, tax, and service charge from the provided receipt image.
    
    INSTRUCTIONS:
    INSTRUCTIONS:
1. Format the response as a JSON object with this structure:
   {
     "items": [{"name": string, "quantity": number, "price": number}],
     "tax": number (null if not found),
     "serviceCharge": number (null if not found)
   }

2. Extract food/drink items with accurate quantity and UNIT PRICE.
   - UNIT PRICE is the price per item, not the line total.

3. PRICE INTERPRETATION RULES:
   a. If the line contains "@price" (e.g., "2 Ayam Geprek @20.000"):
      - quantity = the number before the item name
      - price = the "@price" value
      - ignore any total shown on the same line

   b. If the line has quantity and a total but no "@":
      - price = total ÷ quantity

   c. If the line shows a single price with no quantity:
      - quantity = 1
      - price = the shown price

   d. Never multiply incorrectly. Always return the UNIT PRICE.

4. Look for tax (terms include: "tax", "pajak", "ppn", "vat", etc.)

5. Look for service charge (terms include: "service charge", "service", "layanan", etc.)

6. If tax or service charge is not found, set them to null.

7. Remove all currency symbols and formatting:
   - Remove "Rp", "IDR", spaces, dots, commas.

8. Only include actual food/drink items, not headers, footers, or totals.

9. Handle different receipt formats and languages.

10. Handle inconsistent spacing, punctuation, and formatting.

11. Output must be valid JSON with NO additional text or markdown.
    
    EXAMPLE OUTPUT:
    {
      "items": [
        {"name": "Burger", "quantity": 2, "price": 15000},
        {"name": "French Fries", "quantity": 1, "price": 10000}
      ],
      "tax": 2500,
      "serviceCharge": 2000
    }
    
    Return ONLY the JSON object, with no additional text or markdown formatting.`;

    console.log('Preparing image data...');
    const imagePart = base64ToGenerativePart(imageData, 'image/jpeg');
    
    console.log('Sending request to Gemini...');
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            { inlineData: imagePart.inlineData }
          ]
        }
      ]
    });

    console.log('Received response from Gemini, processing...');
    console.log(response);
    if (!response.text) {
      throw new Error('No response text from AI service');
    }

    // Access the response text
    const text = response.text;
    console.log('Gemini raw response:', text);
    
    // Parse and validate the response
    let jsonString = text.trim();
    const jsonMatch = jsonString.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonString = jsonMatch[0];
    }

    const parsedData = safeJsonParse(jsonString);
    
    // Extract items from the response
    let items = [];
    let tax = null;
    let serviceCharge = null;
    
    if (parsedData && typeof parsedData === 'object') {
      items = parsedData.items || [];
      tax = parsedData.tax || null;
      serviceCharge = parsedData.serviceCharge || null;
    } else if (Array.isArray(parsedData)) {
      // Backward compatibility for old format
      items = parsedData;
    }
    
    if (!Array.isArray(items)) {
      throw new Error('Expected items array in the response');
    }

    // Validate and clean up items
    const validItems = items
      .filter((item: any) => item && 
        typeof item.name === 'string' && 
        item.name.trim() !== '' &&
        typeof item.price === 'number' && 
        !isNaN(item.price) && 
        isFinite(item.price) &&
        item.price > 0
      )
      .map((item: any) => ({
        name: String(item.name || '').trim(),
        quantity: typeof item.quantity === 'number' && !isNaN(item.quantity) && item.quantity > 0 
          ? Math.floor(Number(item.quantity)) 
          : 1,
        price: Math.max(0, Number(item.price))
      }));

    const processingTime = Date.now() - requestStartTime;
    console.log(`Successfully processed ${validItems.length} items in ${processingTime}ms`);
    
    return NextResponse.json({ 
      success: true,
      items: validItems,
      tax: tax,
      serviceCharge: serviceCharge,
      processingTime: `${processingTime}ms`
    });

  } catch (error) {
    const processingTime = Date.now() - requestStartTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    // kalo gemini overload (503)
    let userFriendlyMessage = 'Failed to process receipt';
    if (errorMessage.includes('503') || errorMessage.includes('overloaded') || errorMessage.includes('UNAVAILABLE')) {
      userFriendlyMessage = 'Server is currently busy, please try again later or try Manual Input';
      console.log('Gemini API is overloaded - providing user-friendly message');
    }

    console.error('Error processing receipt:', {
      error: errorMessage,
      processingTime: `${processingTime}ms`,
      timestamp: new Date().toISOString(),
      ...(error instanceof Error && { stack: error.stack })
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process receipt',
        message: userFriendlyMessage,
        processingTime: `${processingTime}ms`,
        ...(process.env.NODE_ENV === 'development' ? {
          debug: {
            error: errorMessage,
            stack: error instanceof Error ? error.stack : undefined
          }
        } : {})
      },
      {
        status: 500,
        headers: {
          'X-Processing-Time': `${processingTime}ms`,
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          'X-Content-Type-Options': 'nosniff',
        }
      }
    );
  }
}
