package com.maakleerplek.datafetcher.service;

import com.maakleerplek.datafetcher.dto.EventDTO;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

@Service
public class ScraperService {

    private static final String CALENDAR_URL = "https://maakleerplek.be/kalender/";

    public List<EventDTO> fetchLatestEvents() {
        List<EventDTO> events = new ArrayList<>();
        try {
            Document doc = Jsoup.connect(CALENDAR_URL)
                    .userAgent("Mozilla/5.0")
                    .get();

            Elements items = doc.select("article.archive_item");

            for (Element item : items) {
                String title = item.select(".right h3 a").text().trim();
                String date = item.select(".right .additional-info .agenda_datum").text().trim();
                
                // Get image src, check data-src as well for lazy loading
                Element img = item.select(".left a.archive_image img").first();
                String imageUrl = "";
                if (img != null) {
                    imageUrl = img.hasAttr("data-src") ? img.attr("data-src") : img.attr("src");
                }
                
                // Get location - paragraph in additional-info without agenda_datum class
                String location = item.select(".right .additional-info p:not(.agenda_datum)").text().trim();

                // Get description/excerpt
                String description = item.select(".right > p").text().trim();

                events.add(new EventDTO(title, date, imageUrl, location, description));
                
                // Limit to latest 5 for now
                if (events.size() >= 5) break;
            }
        } catch (IOException e) {
            // Log error or rethrow
            System.err.println("Error fetching calendar: " + e.getMessage());
        }
        return events;
    }
}
