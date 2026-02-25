package com.maakleerplek.datafetcher.dto;

public class EventDTO {
    private String title;
    private String date;
    private String imageUrl;
    private String location;
    private String description;

    public EventDTO() {}

    public EventDTO(String title, String date, String imageUrl, String location, String description) {
        this.title = title;
        this.date = date;
        this.imageUrl = imageUrl;
        this.location = location;
        this.description = description;
    }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getDate() { return date; }
    public void setDate(String date) { this.date = date; }

    public String getImageUrl() { return imageUrl; }
    public void setImageUrl(String imageUrl) { this.imageUrl = imageUrl; }

    public String getLocation() { return location; }
    public void setLocation(String location) { this.location = location; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
}
