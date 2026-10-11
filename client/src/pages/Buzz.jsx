import { Zap } from "lucide-react";
import Feed from "../components/Feed";

export default function Buzz() {
  return (
    <Feed
      title="Buzz"
      subtitle="Flash news from around campus: sports, events, part-time jobs and workshops."
      endpoint="/buzz"
      socketEvent="buzz:new"
      icon={Zap}
      categories={["Sports", "Event Registration", "Part-time Job", "Camp/Workshop", "Other"]}
    />
  );
}
