backend 
.\mvnw clean package -DskipTests
java -jar target\booking-system-0.0.1-SNAPSHOT.jar

frontend 
npm run build
npm run preview

tunnel --config cloudflared-config.yml run 745ab8be-c55c-4e72-b985-d918206ca82f