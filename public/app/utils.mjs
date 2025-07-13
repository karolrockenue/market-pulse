// /public/app/utils.mjs

/**
 * Fetches an HTML component and injects it into a placeholder element on the page.
 * It also initializes Alpine.js for the newly added content.
 * @param {string} componentName - The name of the html file (e.g., 'header').
 * @param {string} placeholderId - The ID of the div to inject the HTML into.
 */
export async function loadComponent(componentName, placeholderId) {
  try {
    // Fetch the component's HTML from the /_shared/ directory
    const response = await fetch(`/app/_shared/${componentName}.html`);
    if (!response.ok) {
      throw new Error(`Failed to fetch component: ${response.statusText}`);
    }
    const html = await response.text();
    const placeholder = document.getElementById(placeholderId);

    if (placeholder) {
      // Inject the fetched HTML into the placeholder div
      placeholder.innerHTML = html;
      // IMPORTANT: This tells Alpine.js to scan the new HTML and make it interactive
      Alpine.initTree(placeholder);
    }
  } catch (error) {
    console.error(`Error loading component ${componentName}:`, error);
  }
}
