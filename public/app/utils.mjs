// public/app/utils.mjs

/**
 * Fetches an HTML component and injects it into a target element.
 * @param {string} componentPath - The path to the HTML component file.
 * @param {string} targetElementId - The ID of the element to inject the component into.
 */
export async function loadComponent(componentPath, targetElementId) {
  const targetElement = document.getElementById(targetElementId);
  if (!targetElement) {
    console.error(`Target element with ID "${targetElementId}" not found.`);
    return;
  }
  try {
    const response = await fetch(componentPath);
    if (!response.ok) {
      throw new Error(`Could not load component: ${response.statusText}`);
    }
    const html = await response.text();
    targetElement.innerHTML = html;
  } catch (error) {
    console.error(`Failed to load component from "${componentPath}":`, error);
    targetElement.innerHTML = `<p class="text-red-500 text-center">Error loading component.</p>`;
  }
}
