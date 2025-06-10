const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');

// GET /api/weather
router.get('/', authMiddleware, async (req, res) => {
  const { lat, lon } = req.query;
  
  if (!lat || !lon) {
    return res.status(400).json({ error: 'Latitude and longitude are required' });
  }

  try {
    const apiKey = process.env.OPENWEATHER_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Weather service not configured' });
    }

    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Weather API responded with status: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Transform the data to match your frontend interface
    const weatherData = {
      location: `${data.name}, ${data.sys.country}`,
      temperature: Math.round((data.main.temp * 9/5) + 32), // Convert Celsius to Fahrenheit
      description: data.weather[0].description,
      icon: data.weather[0].icon,
      humidity: data.main.humidity,
      windSpeed: Math.round(data.wind.speed * 2.237) // Convert m/s to mph
    };
    
    res.json(weatherData);
  } catch (error) {
    console.error('Error fetching weather:', error);
    res.status(500).json({ error: 'Unable to fetch weather data' });
  }
});

module.exports = router;