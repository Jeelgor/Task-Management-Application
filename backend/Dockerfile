FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy prisma schema and generate client
COPY prisma ./prisma/
RUN npx prisma generate

# Copy the rest of the backend source code
COPY . .

# Build TypeScript code
RUN npm run build

# Expose the port
EXPOSE 3001

# Run the production server
CMD ["npm", "start"]
