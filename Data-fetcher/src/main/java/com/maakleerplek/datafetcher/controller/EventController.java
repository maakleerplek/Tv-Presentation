package com.maakleerplek.datafetcher.controller;

import com.maakleerplek.datafetcher.dto.EventDTO;
import com.maakleerplek.datafetcher.service.ScraperService;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*") // For local dev/TV display
public class EventController {

    private final ScraperService scraperService;

    public EventController(ScraperService scraperService) {
        this.scraperService = scraperService;
    }

    @GetMapping("/latest-event")
    public List<EventDTO> getLatestEvents() {
        return scraperService.fetchLatestEvents();
    }
}
