import * as cheerio from 'cheerio';

export async function extractIngredientsFromUrl(url: string): Promise<string[]> {
  try {
    const res = await fetch(url);
    const html = await res.text();
    const $ = cheerio.load(html);

    let ingredients: string[] = [];

    // Strategy 1: Targeted common ingredient list selectors
    $('ul.ingredients li, .ingredient-list li, .recipe-ingredients li, .ingredients-list li, [class*="ingredient"] li').each((i, el) => {
      const text = $(el).text().trim();
      if (text && text.length > 2 && !ingredients.includes(text)) {
        ingredients.push(text);
      }
    });

    // Strategy 2: Broad deep-scan fallback for complex blogs
    if (ingredients.length === 0) {
      $('li, p, div, span').each((i, el) => {
        // Prevent capturing giant structural wrappers
        if ($(el).children().length > 3) return;

        const text = $(el).text().trim();
        // Check if string contains metric units or volume tokens
        if (
          text && 
          text.length < 100 && 
          text.toLowerCase().match(/\b(cup|tbsp|tsp|teaspoon|tablespoon|gram|kg|piece|bunch|dozen|ml|lbs|oz|pinch|sliced|chopped|g|kg)\b/)
        ) {
          if (!ingredients.includes(text)) {
            ingredients.push(text);
          }
        }
      });
    }

    // Limit array to make it clean and readable
    return ingredients.slice(0, 20);
  } catch (err) {
    console.error("Scraper Error:", err);
    return [];
  }
}