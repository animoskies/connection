import type { Metadata } from "next";
import { getPublicPhotoByToken, normalizePublicUsername } from "@/lib/public-photo-share";
import { PublicPhotoPageClient } from "./PublicPhotoPageClient";

type Params = {
  params: Promise<{ token: string }>;
};

export const dynamic = "force-dynamic";

function appBaseUrl() {
  const explicit = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`;
  return "https://connection-amber.vercel.app";
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { token } = await params;
  const baseUrl = appBaseUrl();
  const url = `${baseUrl}/p/${token}`;
  const imageUrl = `${baseUrl}/api/public/photos/${token}/image`;
  const { photo } = await getPublicPhotoByToken(token);

  if (!photo) {
    return {
      title: "Connection",
      description: "A shared photo on Connection.",
      alternates: { canonical: url }
    };
  }

  const owner = normalizePublicUsername(photo.profiles?.username ?? photo.profiles?.display_name ?? "someone");
  const description = photo.caption?.trim() || `A photo shared by ${owner} on Connection.`;
  const title = photo.caption?.trim() ? `${owner} on Connection` : "Connection";

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: "Connection",
      type: "article",
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 1600,
          alt: description
        }
      ]
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl]
    }
  };
}

export default async function PublicPhotoPage({ params }: Params) {
  const { token } = await params;
  return <PublicPhotoPageClient token={token} />;
}
