module.exports = (req, res) => {
  res.json({
    message: 'Hello from Vercel!',
    method: req.method,
    body: req.body,
    query: req.query
  });
};