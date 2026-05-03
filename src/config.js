// Set this to your live website URL (e.g., https://your-site.vercel.app)
// If you are testing locally, use your computer's IP address (e.g., http://192.168.1.5:5173)
const BASE_URL = window.location.origin.includes('localhost') 
  ? 'https://member-sheet.vercel.app' // Default placeholder
  : window.location.origin;

export default BASE_URL;
