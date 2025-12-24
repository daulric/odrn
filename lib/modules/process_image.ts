import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

interface ProcessedImageBuffer {
  buffer: ArrayBuffer;
  contentType: string;
  extension: string;
  width: number;
  height: number;
  uri: string;
}

export const processImage = async (uri: string): Promise<ProcessedImageBuffer> => {
  try {
    
    const context = await ImageManipulator.manipulate(uri);
    const image = await context.renderAsync();

    const result = await image.saveAsync({
      format: SaveFormat.JPEG,
    })

    const response = await fetch(result.uri);
    const buffer = await response.arrayBuffer();

    return {
      buffer,
      uri: result.uri,
      contentType: 'image/jpeg',
      extension: 'jpeg',
      width: result.width,
      height: result.height,
    };

  } catch (error) {
    console.error("Error processing image to buffer:", error);
    throw error;
  }
};